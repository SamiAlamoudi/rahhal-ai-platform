/**
 * Bilamo Live Flights Vertical Slice — unit + integration coverage.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BILAMO_FLIGHT_SCORE_WEIGHTS,
  __resetBilamoFlightCacheForTests,
  createBilamoFlightSearchProvider,
  createDemoFlightSearchProvider,
  createLiveFlightSearchProvider,
  recommendFlights,
  scoreFlightOffer,
  scoredOfferToBilamoFlight,
  type NormalizedFlightOffer,
} from '../bilamo/flights'
import { bilamoResultToTravelAgentTurn, runBilamoIntelligenceTurn } from '../bilamo/intelligence'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function offer(partial: Partial<NormalizedFlightOffer> & Pick<NormalizedFlightOffer, 'offerId' | 'totalPrice' | 'durationMinutes' | 'stops'>): NormalizedFlightOffer {
  return {
    airline: 'Saudia',
    flightNumber: 'SV100',
    origin: 'RUH',
    destination: 'HND',
    departAt: '2026-09-12T08:40:00Z',
    arriveAt: '2026-09-12T18:55:00Z',
    layovers: partial.stops > 0 ? [{ airport: 'DXB', durationMinutes: 120 }] : [],
    cabin: 'economy',
    baggageSummary: '2 PC',
    refundable: true,
    changeable: true,
    currency: 'SAR',
    provider: 'demo',
    bookingReference: null,
    deepLink: null,
    fetchedAt: '2026-08-06T00:00:00.000Z',
    meta: { demo: true, dataSource: 'demo' },
    ...partial,
  }
}

function msg(role: 'user' | 'assistant', content: string, providerMeta: Record<string, unknown> = {}): ChatMessage {
  const now = '2026-08-06T00:00:00.000Z'
  return {
    id: `${role}-${content.slice(0, 8)}`,
    conversationId: 'bilamo-flights',
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta,
    createdAt: now,
    updatedAt: now,
  }
}

afterEach(() => {
  __resetBilamoFlightCacheForTests()
})

describe('Bilamo FlightSearchProvider — demo mode', () => {
  it('returns deterministic normalized offers without credentials', async () => {
    const provider = createDemoFlightSearchProvider()
    const result = await provider.searchFlights({
      origin: 'RUH',
      destination: 'HND',
      departureDate: '2026-09-12',
      adults: 2,
      currency: 'SAR',
    })
    expect(result.ok).toBe(true)
    expect(result.mode).toBe('demo')
    expect(result.offers.length).toBeGreaterThanOrEqual(2)
    for (const row of result.offers) {
      expect(row.offerId).toBeTruthy()
      expect(row.airline).toBeTruthy()
      expect(row.origin).toBe('RUH')
      expect(row.destination).toBe('HND')
      expect(row.totalPrice).toBeGreaterThan(0)
      expect(row.currency).toBe('SAR')
      expect(row.meta.demo).toBe(true)
      expect(row.fetchedAt).toBeTruthy()
    }
    const health = await provider.healthCheck()
    expect(health.ok).toBe(true)
    expect(health.mode).toBe('demo')
  })

  it('honors direct-only preference', async () => {
    const provider = createDemoFlightSearchProvider()
    const result = await provider.searchFlights({
      origin: 'RUH',
      destination: 'IST',
      departureDate: '2026-10-01',
      adults: 1,
      directOnly: true,
    })
    expect(result.offers.every((o) => o.stops === 0)).toBe(true)
  })
})

describe('Bilamo Recommendation Engine V1', () => {
  it('scores with configurable weights and returns best / cheapest / fastest', () => {
    const cohort = [
      offer({ offerId: 'direct', totalPrice: 2890, durationMinutes: 620, stops: 0, airline: 'Saudia' }),
      offer({
        offerId: 'cheap',
        totalPrice: 2420,
        durationMinutes: 780,
        stops: 1,
        airline: 'Emirates',
        departAt: '2026-09-12T01:20:00Z',
      }),
      offer({
        offerId: 'fast',
        totalPrice: 3100,
        durationMinutes: 580,
        stops: 0,
        airline: 'Qatar Airways',
      }),
    ]
    const set = recommendFlights(cohort, { preferredAirlines: ['Saudia'], directOnly: false })
    expect(set).not.toBeNull()
    expect(set!.best.kind).toBe('best')
    expect(set!.cheapest.offer.offerId).toBe('cheap')
    expect(set!.fastest.offer.offerId).toBe('fast')
    expect(set!.best.reason.toLowerCase()).toMatch(/recommend|direct|score|balance/)
    expect(set!.best.reason.toLowerCase()).not.toMatch(/\bmock\b/)
    expect(set!.display[0].offer.offerId).toBe(set!.best.offer.offerId)

    const scored = scoreFlightOffer(cohort[0]!, cohort, {}, BILAMO_FLIGHT_SCORE_WEIGHTS)
    expect(scored.score).toBeGreaterThan(0)
    expect(scored.breakdown.price).toBeGreaterThanOrEqual(0)
  })

  it('maps scored offers into BilamoFlightOption UI contract', () => {
    const set = recommendFlights([
      offer({ offerId: 'a', totalPrice: 2890, durationMinutes: 620, stops: 0 }),
      offer({ offerId: 'b', totalPrice: 2420, durationMinutes: 780, stops: 1 }),
    ], {})
    const card = scoredOfferToBilamoFlight(set!.best)
    expect(card.id).toBe(set!.best.offer.offerId)
    expect(card.kind).toBe('best')
    expect(card.kindLabel).toBe('Best overall')
    expect(card.score).toBe(set!.best.score)
    expect(card.reason).toBeTruthy()
    expect(card.stopsLabel).toMatch(/Nonstop|stop/)
  })
})

describe('Bilamo live provider — timeout / failure → demo fallback', () => {
  it('falls back to demo on provider timeout without exposing secrets', async () => {
    const provider = createLiveFlightSearchProvider({
      endpoint: '/api/bilamo-flights-search',
      timeoutMs: 30,
      getAccessToken: async () => 'test-token',
      fetchImpl: async () => {
        await new Promise((r) => setTimeout(r, 80))
        return new Response('{}')
      },
      fallbackToDemo: true,
    })
    const result = await provider.searchFlights({
      origin: 'RUH',
      destination: 'CDG',
      departureDate: '2026-11-01',
      adults: 1,
    })
    expect(result.ok).toBe(true)
    expect(result.mode).toBe('demo')
    expect(result.offers.length).toBeGreaterThan(0)
    expect(JSON.stringify(result)).not.toMatch(/AMADEUS_API_SECRET|client_secret/i)
  })

  it('falls back to demo on HTTP failure', async () => {
    const provider = createLiveFlightSearchProvider({
      getAccessToken: async () => null,
      fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'down' }), { status: 503 }),
      fallbackToDemo: true,
    })
    const result = await provider.searchFlights({
      origin: 'RUH',
      destination: 'LHR',
      departureDate: '2026-12-01',
      adults: 2,
      children: 1,
    })
    expect(result.mode).toBe('demo')
    expect(result.offers.length).toBeGreaterThan(0)
  })
})

describe('Bilamo flights — conversation intelligence flow', () => {
  it('English one-shot complete search recommends with explanation', async () => {
    const turn = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-flights',
      userText: '5 days in Istanbul for 2 travelers from Riyadh, prefer direct flights',
      messages: [msg('user', '5 days in Istanbul for 2 travelers from Riyadh, prefer direct flights')],
    })
    expect(turn).not.toBeNull()
    expect(turn!.phase).toBe('recommending')
    expect(turn!.search?.flights.length).toBeGreaterThan(0)
    expect(turn!.search?.flights[0].reason.toLowerCase()).toMatch(/recommend|direct|score|balance|nonstop/)
    expect(turn!.search?.flights.every((f) => f.stopsLabel === 'Nonstop')).toBe(true)
    expect(turn!.displayText.toLowerCase()).not.toMatch(/\bmock\b|amadeus|api key/)
    expect(turn!.search?.flightsMeta?.mode).toBe('demo')
  })

  it('Arabic natural-language request reaches recommendation', async () => {
    const turn = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-flights',
      userText: '٧ أيام في اليابان لشخصين من الرياض',
      messages: [msg('user', '٧ أيام في اليابان لشخصين من الرياض')],
    })
    expect(turn).not.toBeNull()
    expect(turn!.phase).toBe('recommending')
    expect(turn!.requirements.destination).toMatch(/Japan|Tokyo|اليابان/i)
    expect(turn!.requirements.travelers).toBe(2)
    expect(turn!.search?.flights[0].score).toBeGreaterThan(0)
  })

  it('asks only for dates when destination is known', async () => {
    const turn = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-flights',
      userText: 'I want to fly to Paris',
      messages: [msg('user', 'I want to fly to Paris')],
    })
    expect(turn!.phase).toBe('collecting')
    expect(turn!.askedSlot).toBe('dates')
    expect(turn!.displayText.toLowerCase()).not.toMatch(/budget/)
  })

  it('family traveler counts flow through memory without re-asking destination', async () => {
    const first = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-flights',
      userText: 'Trip to Dubai for a family of 4, 6 days from Jeddah',
      messages: [msg('user', 'Trip to Dubai for a family of 4, 6 days from Jeddah')],
    })
    expect(first!.phase).toBe('recommending')
    expect(first!.requirements.destination).toMatch(/Dubai/i)
    expect(first!.requirements.travelers).toBe(4)
    expect(first!.requirements.origin).toMatch(/Jeddah/i)
    expect(first!.askedSlot).toBeNull()

    const turned = bilamoResultToTravelAgentTurn(first!)
    const followUp = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-flights',
      userText: 'Can we leave a bit earlier?',
      messages: [
        msg('user', 'Trip to Dubai for a family of 4, 6 days from Jeddah'),
        msg('assistant', first!.displayText, turned.meta as unknown as Record<string, unknown>),
        msg('user', 'Can we leave a bit earlier?'),
      ],
    })
    const followDest = String(
      followUp!.requirements.destination
      || followUp!.requirements.destinations?.[0]
      || '',
    )
    expect(followDest).toMatch(/Dubai/i)
    expect(followUp!.requirements.travelers).toBe(4)
    expect(followUp!.askedSlot).not.toBe('destination')
    expect(followUp!.askedSlot).not.toBe('travelers')
  })

  it('planTurn product path never exposes credentials client-side', async () => {
    const service = createTravelAgentService({ bilamoIntelligenceEnabled: true })
    const result = await service.planTurn({
      conversationId: 'bilamo-flights',
      messages: [msg('user', 'Plan 4 days in Lisbon for 2 adults')],
    })
    const blob = JSON.stringify(result)
    expect(blob).not.toMatch(/AMADEUS_API_SECRET|AMADEUS_CLIENT_SECRET|client_secret/i)
    expect(result.meta.bilamo?.search).toBeTruthy()
  })

  it('factory defaults to demo provider', async () => {
    const provider = createBilamoFlightSearchProvider({ mode: 'demo', cache: false })
    expect(provider.providerId).toContain('demo')
    const health = await provider.healthCheck()
    expect(health.mode).toBe('demo')
  })
})

describe('Bilamo server flight search contract', () => {
  it('builds deterministic demo offers and parses search body', async () => {
    const {
      buildDemoBilamoOffers,
      parseBilamoFlightSearchBody,
    } = await import('../../../api/_lib/bilamoFlightSearch')
    const body = parseBilamoFlightSearchBody({
      origin: 'ruh',
      destination: 'ist',
      departureDate: '2026-09-12',
      adults: 2,
      children: 1,
      infants: 0,
      cabin: 'economy',
      directOnly: true,
      currency: 'SAR',
    })
    expect(body).not.toBeNull()
    const offers = buildDemoBilamoOffers(body!)
    expect(offers.every((o) => o.stops === 0)).toBe(true)
    expect(offers.every((o) => o.provider === 'demo')).toBe(true)
    expect(offers[0].offerId).toContain('demo_')
    expect(offers[0].fetchedAt).toBeTruthy()
  })
})

describe('Bilamo live provider — normalization from API payload', () => {
  it('normalizes live API offers without vendor leakage in UI fields', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      mode: 'live',
      offers: [{
        offerId: 'am_1',
        airline: 'Saudia',
        flightNumber: 'SV123',
        origin: 'RUH',
        destination: 'IST',
        departAt: '2026-09-12T09:00:00Z',
        arriveAt: '2026-09-12T13:20:00Z',
        durationMinutes: 260,
        stops: 0,
        layovers: [],
        cabin: 'economy',
        baggageSummary: '2 PC',
        refundable: true,
        changeable: true,
        totalPrice: 1890,
        currency: 'SAR',
        provider: 'amadeus',
        bookingReference: null,
        deepLink: null,
        fetchedAt: '2026-08-06T12:00:00.000Z',
      }],
    }), { status: 200 }))

    const provider = createLiveFlightSearchProvider({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getAccessToken: async () => 'jwt',
      fallbackToDemo: false,
    })
    const result = await provider.searchFlights({
      origin: 'RUH',
      destination: 'IST',
      departureDate: '2026-09-12',
      adults: 1,
    })
    expect(result.mode).toBe('live')
    expect(result.offers[0].provider).toBe('amadeus')
    expect(result.offers[0].meta.demo).toBe(false)
    expect(result.offers[0].airline).toBe('Saudia')
    expect(JSON.stringify(result.offers[0])).not.toMatch(/itineraries|travelerPricings/)
  })
})
