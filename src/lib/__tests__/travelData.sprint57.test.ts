/**
 * Sprint 57 — Real Travel Data Foundation
 */
import { describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import type { ChatMessage } from '../chat/chatTypes'
import {
  ProviderRegistry,
  createMockFlightProvider,
  createMockTravelProviders,
  createTravelDataService,
  prioritizeFlights,
  scoreFlight,
} from '../travelData'

function user(content: string, conversationId = 's57'): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

describe('Sprint 57 — ProviderRegistry + mocks', () => {
  it('registers all mock domains', () => {
    const registry = ProviderRegistry.createWithMocks()
    const snap = registry.snapshot()
    expect(snap.flights).toContain('mock_flights')
    expect(snap.hotels).toContain('mock_hotels')
    expect(snap.activities).toContain('mock_activities')
    expect(snap.restaurants).toContain('mock_restaurants')
    expect(snap.weather).toContain('mock_weather')
    expect(snap.maps).toContain('mock_maps')
    expect(snap.currency).toContain('mock_currency')
    expect(snap.visa).toContain('mock_visa')
  })

  it('allows swapping a flight provider without touching other domains', async () => {
    const registry = ProviderRegistry.createWithMocks()
    const alt = createMockFlightProvider('future_amadeus_slot')
    registry.registerFlight(alt)
    registry.setPreferred('flights', 'future_amadeus_slot')
    const flights = await registry.getFlight().searchFlights({
      origin: 'RUH',
      destination: 'RAK',
      departDate: '2026-08-10',
    })
    expect(flights[0]?.provenance.provider).toBe('future_amadeus_slot')
    expect(registry.getHotel().id).toBe('mock_hotels')
  })
})

describe('Sprint 57 — TravelDataService', () => {
  it('fetches normalized flights/hotels/activities/restaurants/weather with provenance', async () => {
    const service = createTravelDataService()
    const flights = await service.searchFlights({
      origin: 'RUH',
      destination: 'AGA',
      departDate: '2026-08-12',
      adults: 2,
      currency: 'SAR',
    })
    expect(flights.length).toBeGreaterThan(0)
    expect(flights[0]?.price.currency).toBe('SAR')
    expect(flights[0]?.provenance).toMatchObject({
      provider: 'mock_flights',
      estimated: true,
    })
    expect(flights[0]?.provenance.confidence).toBeGreaterThan(0)
    expect(flights[0]?.provenance.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const hotels = await service.searchHotels({
      city: 'Agadir',
      checkIn: '2026-08-12',
      checkOut: '2026-08-19',
      currency: 'SAR',
    })
    expect(hotels[0]?.city).toBe('Agadir')
    expect(hotels[0]?.provenance.provider).toBe('mock_hotels')

    const activities = await service.searchActivities({ city: 'Agadir' })
    expect(activities[0]?.title).toMatch(/Agadir/)
    const restaurants = await service.searchRestaurants({ city: 'Agadir' })
    expect(restaurants[0]?.cuisine).toBeTruthy()
    const weather = await service.getWeather({ location: 'Agadir', date: '2026-08-12' })
    expect(weather[0]?.tempC.max).toBeGreaterThan(weather[0]!.tempC.min)
  })

  it('caches repeated flight queries', async () => {
    const service = createTravelDataService({ cacheTtlMs: 30_000 })
    const q = {
      origin: 'RUH',
      destination: 'CMN',
      departDate: '2026-09-01',
    }
    const a = await service.searchFlights(q)
    const b = await service.searchFlights(q)
    expect(b).toBe(a)
  })

  it('merges a destination bundle and scores it', async () => {
    const service = createTravelDataService()
    const offer = await service.buildDestinationBundle({
      origin: 'RUH',
      destination: 'AGA',
      destinationCity: 'Agadir',
      departDate: '2026-08-12',
      checkIn: '2026-08-12',
      checkOut: '2026-08-19',
      adults: 2,
      currency: 'SAR',
      nationality: 'SA',
      destinationCountry: 'Morocco',
    })
    expect(offer.flights.length).toBeGreaterThan(0)
    expect(offer.hotels.length).toBeGreaterThan(0)
    expect(offer.activities.length).toBeGreaterThan(0)
    expect(offer.restaurants.length).toBeGreaterThan(0)
    expect(offer.weather.length).toBeGreaterThan(0)
    expect(offer.score).toBeGreaterThan(0)
    expect(offer.provenance.provider).toBe('travel_data_service')
  })

  it('prioritizes direct flights over one-stop when similar', () => {
    const bundle = createMockTravelProviders()
    expect(bundle.flights).toBeTruthy()
    const ranked = prioritizeFlights([
      {
        id: 'a',
        origin: 'RUH',
        destination: 'AGA',
        departAt: '2026-08-12T08:00:00.000Z',
        arriveAt: '2026-08-12T12:00:00.000Z',
        airline: 'SV',
        flightNumber: 'SV1',
        cabin: 'economy',
        stops: 1,
        durationMinutes: 400,
        price: { amount: 1000, currency: 'SAR' },
        provenance: {
          confidence: 0.7,
          lastUpdated: new Date().toISOString(),
          provider: 'mock',
          estimated: true,
        },
      },
      {
        id: 'b',
        origin: 'RUH',
        destination: 'AGA',
        departAt: '2026-08-12T08:00:00.000Z',
        arriveAt: '2026-08-12T12:00:00.000Z',
        airline: 'SV',
        flightNumber: 'SV2',
        cabin: 'economy',
        stops: 0,
        durationMinutes: 320,
        price: { amount: 1100, currency: 'SAR' },
        provenance: {
          confidence: 0.7,
          lastUpdated: new Date().toISOString(),
          provider: 'mock',
          estimated: true,
        },
      },
    ])
    expect(scoreFlight(ranked[0]!)).toBeGreaterThanOrEqual(scoreFlight(ranked[1]!))
    expect(ranked[0]?.stops).toBe(0)
  })
})

describe('Sprint 57 — conversation flow unchanged', () => {
  it('planTurn still works without importing travelData into Conversation Brain', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 's57-conv',
      messages: [user('أريد السفر للمغرب', 's57-conv')],
    })
    expect(turn.reply).toMatch(/المغرب|Morocco|أغادير|أكادير|مراكش/i)
    expect(turn.meta.tripState?.cardsAllowed).toBe(false)
    // Foundation stays decoupled — no travelData leakage into agent meta.
    expect(turn.meta).not.toHaveProperty('travelData')
  })
})
