/**
 * Sprint 74 — Conversation → Flight/Hotel Search Engine integration.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  createMockAgentToolRegistry,
  createMockFlightSearchTool,
  createMockHotelSearchTool,
  emptyRequirements,
  resolveAirportCode,
} from '../agent'
import {
  createFlightSearchEngine,
  resetDefaultFlightSearchEngine,
} from '../agent/flightSearchEngine'
import {
  createHotelSearchEngine,
  resetDefaultHotelSearchEngine,
} from '../agent/hotelSearchEngine'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import type { AgentToolContext } from '../agent/tools/types'
import {
  buildFlightSearchRequest,
  buildHotelSearchRequest,
  runFlightSearchTool,
  runHotelSearchTool,
} from '../agent/tools/searchEngineBridge'

function ctx(partial: Partial<AgentToolContext['requirements']> & {
  input?: Record<string, unknown>
  locale?: 'ar' | 'en'
}): AgentToolContext {
  return {
    requirements: {
      ...emptyRequirements(),
      ...partial,
    },
    tripPlan: null,
    itinerary: null,
    locale: partial.locale ?? 'en',
    input: partial.input,
  }
}

describe('Sprint 74 — Conversation search integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    resetDefaultHotelSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    resetDefaultHotelSearchEngine()
  })

  it('resolves city names to IATA for Riyadh → Tokyo', () => {
    expect(resolveAirportCode('Riyadh')).toBe('RUH')
    expect(resolveAirportCode('Tokyo')).toBe('HND')
    expect(resolveAirportCode('ruh')).toBe('RUH')
  })

  it('builds flight + hotel engine requests from conversation context', () => {
    const flightReq = buildFlightSearchRequest(ctx({
      origin: 'Riyadh',
      destination: 'Tokyo',
      startDate: '2026-08-10',
      endDate: '2026-08-17',
      travelers: 1,
      budgetCurrency: 'SAR',
      input: { origin: 'Riyadh', destination: 'Tokyo', travelers: 1 },
    }))
    expect(flightReq).toMatchObject({
      origin: 'RUH',
      destination: 'HND',
      tripType: 'round_trip',
      departureDate: '2026-08-10',
      returnDate: '2026-08-17',
      adults: 1,
      currency: 'SAR',
    })

    const hotelReq = buildHotelSearchRequest(ctx({
      destination: 'Tokyo',
      startDate: '2026-08-10',
      durationDays: 8,
      travelers: 1,
      budgetCurrency: 'SAR',
      input: { destination: 'Tokyo', nights: 7, travelers: 1 },
    }))
    expect(hotelReq.city).toBe('Tokyo')
    expect(hotelReq.checkIn).toBe('2026-08-10')
    expect(hotelReq.adults).toBe(1)
  })

  it('default registry flights/hotels tools use search engines (not aggregation)', async () => {
    const registry = createMockAgentToolRegistry()
    expect(registry.get('flights')?.providerId).toBe('flight-search-engine')
    expect(registry.get('hotels')?.providerId).toBe('hotel-search-engine')

    const results = await registry.runAvailable({
      requirements: {
        ...emptyRequirements(),
        origin: 'Riyadh',
        destination: 'Tokyo',
        destinations: ['Tokyo'],
        startDate: '2026-08-10',
        endDate: '2026-08-17',
        durationDays: 8,
        travelers: 1,
        budgetCurrency: 'SAR',
      },
      tripPlan: null,
      itinerary: null,
      locale: 'en',
    }, ['flights', 'hotels'])

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.status === 'ok')).toBe(true)
    const flights = results.find((r) => r.tool === 'flights')
    const hotels = results.find((r) => r.tool === 'hotels')
    const flightData = (flights?.data ?? {}) as Record<string, unknown>
    const hotelData = (hotels?.data ?? {}) as Record<string, unknown>
    expect(flightData.searchEngine).toBe('flightSearchEngine')
    expect(hotelData.searchEngine).toBe('hotelSearchEngine')
    expect(Array.isArray(flightData.offers) && flightData.offers.length).toBeGreaterThan(0)
    expect(Array.isArray(hotelData.stays) && hotelData.stays.length).toBeGreaterThan(0)
    expect(flightData.highlights).toMatchObject({
      best: expect.any(String),
      cheapest: expect.any(String),
      fastest: expect.any(String),
    })
  })

  it('supports one-way, round-trip, and multi-city via engine bridge', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })

    const oneWay = await runFlightSearchTool(engine, ctx({
      origin: 'RUH',
      destination: 'DXB',
      startDate: '2026-09-01',
      travelers: 1,
      input: { origin: 'RUH', destination: 'DXB', startDate: '2026-09-01', travelers: 1 },
    }))
    expect(oneWay.empty).toBe(false)

    const roundTrip = await runFlightSearchTool(engine, ctx({
      origin: 'Riyadh',
      destination: 'Tokyo',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      travelers: 2,
    }))
    expect(roundTrip.empty).toBe(false)
    expect((roundTrip.data.offers as unknown[]).length).toBeGreaterThan(0)

    const multi = await runFlightSearchTool(engine, ctx({
      origin: 'Riyadh',
      destination: 'Paris',
      destinations: ['Paris', 'Rome'],
      startDate: '2026-09-01',
      endDate: '2026-09-12',
      travelers: 2,
      budgetCurrency: 'SAR',
    }))
    expect(multi.empty).toBe(false)
  })

  it('applies business / family / budget / luxury request shaping', () => {
    const business = buildFlightSearchRequest(ctx({
      origin: 'Jeddah',
      destination: 'London',
      travelerType: 'business',
      tripPurpose: 'business',
      startDate: '2026-09-05',
      endDate: '2026-09-08',
      travelers: 1,
    }))
    expect(business.cabin).toBe('business')

    const familyHotel = buildHotelSearchRequest(ctx({
      destination: 'Dubai',
      travelerType: 'family',
      travelers: 4,
      startDate: '2026-09-01',
      durationDays: 6,
    }))
    expect(familyHotel.rooms).toBe(2)

    const budget = buildFlightSearchRequest(ctx({
      origin: 'Riyadh',
      destination: 'Cairo',
      budgetStyle: 'budget',
      budgetAmount: 3000,
      startDate: '2026-09-01',
      endDate: '2026-09-05',
    }))
    expect(budget.filters?.maxPrice).toBe(Math.round(3000 * 0.45))

    const luxury = buildHotelSearchRequest(ctx({
      destination: 'Maldives',
      budgetStyle: 'luxury',
      budgetAmount: 40000,
      startDate: '2026-09-01',
      durationDays: 7,
    }))
    expect(luxury.filters?.minStars).toBe(4)
  })

  it('hotel-only and flight-only tools still return engine payloads', async () => {
    const flights = createMockFlightSearchTool()
    const hotels = createMockHotelSearchTool()
    const flightResult = await flights.execute(ctx({
      origin: 'Riyadh',
      destination: 'Tokyo',
      startDate: '2026-08-15',
      endDate: '2026-08-22',
      travelers: 1,
      packageScope: 'flights_only',
      input: { origin: 'Riyadh', destination: 'Tokyo', travelers: 1, startDate: '2026-08-15' },
    }))
    const hotelResult = await hotels.execute(ctx({
      destination: 'Tokyo',
      startDate: '2026-08-15',
      durationDays: 5,
      travelers: 2,
      input: { destination: 'Tokyo', nights: 4, travelers: 2 },
    }))
    expect(flightResult.status).toBe('ok')
    expect(hotelResult.status).toBe('ok')
    expect((flightResult.data as Record<string, unknown> | undefined)?.searchEngine).toBe('flightSearchEngine')
    expect((hotelResult.data as Record<string, unknown> | undefined)?.searchEngine).toBe('hotelSearchEngine')
  })

  it('planTurn for Riyadh→Tokyo uses search-engine-backed tools', async () => {
    const conversationId = 'sprint74-tokyo'
    const service = (await import('../agent/travelAgentService')).createTravelAgentService({
      concierge: false,
      autonomousAgentEnabled: true,
      bookingIntelligenceEnabled: true,
    })
    const messages = [
      {
        id: 'u1',
        conversationId,
        role: 'user' as const,
        modality: 'text' as const,
        content:
          'I want a solo trip to Tokyo for 7 days in August, budget 12000 SAR from Riyadh',
        audioUrl: null,
        imageUrl: null,
        attachments: [],
        status: 'complete' as const,
        error: null,
        providerMeta: {},
        createdAt: '2026-07-20T00:00:00.000Z',
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
    ]
    const result = await service.planTurn({ conversationId, messages })

    expect(result.reply.length).toBeGreaterThan(10)
    const toolResults = result.meta?.toolResults ?? []
    const flightRun = toolResults.find((t) => t.tool === 'flights')
    const hotelRun = toolResults.find((t) => t.tool === 'hotels')
    expect(flightRun?.providerId).toBe('flight-search-engine')
    expect(hotelRun?.providerId).toBe('hotel-search-engine')
    expect(flightRun?.status).toBe('ok')
    expect(hotelRun?.status).toBe('ok')
    expect(
      result.meta?.memory?.requirements?.destination?.toLowerCase().includes('tokyo')
      || result.meta?.memory?.requirements?.destinations?.some((d) =>
        d.toLowerCase().includes('tokyo'))
      || /tokyo/i.test(result.reply),
    ).toBe(true)
    expect(result.tripPlan?.flights?.length ?? 0).toBeGreaterThan(0)
  })

  it('mock mode returns offers via engines; graceful empty handled', async () => {
    const engine = createHotelSearchEngine({ forceMock: true })
    const page = await runHotelSearchTool(engine, ctx({
      destination: 'Tokyo',
      startDate: '2026-08-01',
      durationDays: 4,
      travelers: 2,
    }))
    expect(page.empty).toBe(false)
    expect((page.data.stays as unknown[]).length).toBeGreaterThan(0)
  })
})
