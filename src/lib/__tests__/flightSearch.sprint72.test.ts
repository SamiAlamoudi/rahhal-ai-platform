/**
 * Sprint 72 — Flight Search Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  applyFlightFilters,
  createFlightSearchEngine,
  decodeFlightCursor,
  dedupeFlights,
  encodeFlightCursor,
  enrichMockFlight,
  normalizeFlightOffer,
  paginateFlights,
  rankFlights,
  resetDefaultFlightSearchEngine,
  sortFlights,
  SPRINT72_FLIGHT_SEARCH_VERSION,
} from '../agent/flightSearchEngine'
import {
  createProviderRuntimeRegistry,
  resetDefaultProviderRuntimeRegistry,
} from '../agent/providerRuntime'
import type { UnifiedFlight } from '../agent/flightSearchEngine'

function sampleFlights(): UnifiedFlight[] {
  return [
    enrichMockFlight({ origin: 'RUH', destination: 'DXB', price: 500, duration: 120, stops: 0, airline: 'SV' }, 0),
    enrichMockFlight({ origin: 'RUH', destination: 'DXB', price: 400, duration: 180, stops: 1, airline: 'F3', refundable: false }, 1),
    enrichMockFlight({ origin: 'RUH', destination: 'DXB', price: 600, duration: 110, stops: 0, airline: 'EK', refundable: true }, 2),
    {
      ...enrichMockFlight({ origin: 'RUH', destination: 'DXB', price: 390, duration: 120, stops: 0, airline: 'SV', refundable: true }, 3),
      provider: 'amadeus',
      departureTime: '2026-08-01T08:00:00Z',
      arrivalTime: '2026-08-01T10:00:00Z',
    },
  ]
}

describe('Sprint 72 — Flight Search Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
  })

  it('exposes engine version and searchFlights in mock mode', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })
    expect(engine.version).toBe(SPRINT72_FLIGHT_SEARCH_VERSION)
    const page = await engine.searchFlights({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-09-01',
    })
    expect(page.flights.length).toBeGreaterThan(0)
    expect(page.diagnostics.requestId).toMatch(/^flt_/)
    expect(page.diagnostics.providersUsed.length).toBeGreaterThan(0)
    expect(page.flights[0]).toMatchObject({
      origin: 'RUH',
      destination: 'DXB',
      currency: expect.any(String),
      bookingToken: expect.any(String),
    })
  })

  it('supports one-way, round-trip, and multi-city', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })
    const oneWay = await engine.searchOneWay({
      origin: 'RUH',
      destination: 'JED',
      departureDate: '2026-09-10',
    })
    expect(oneWay.flights.length).toBeGreaterThan(0)

    const roundTrip = await engine.searchRoundTrip({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-09-10',
      returnDate: '2026-09-17',
    })
    expect(roundTrip.flights[0]?.providerMetadata.tripType).toBe('round_trip')

    const multi = await engine.searchMultiCity({
      legs: [
        { origin: 'RUH', destination: 'DXB', departureDate: '2026-09-10' },
        { origin: 'DXB', destination: 'IST', departureDate: '2026-09-14' },
      ],
    })
    expect(multi.flights[0]?.providerMetadata.tripType).toBe('multi_city')
  })

  it('ranks by recommendation score', () => {
    const ranked = rankFlights(sampleFlights(), { preferredAirlines: ['EK'] })
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0)
  })

  it('deduplicates identical itineraries keeping highest confidence', () => {
    const amadeus = enrichMockFlight({
      origin: 'RUH',
      destination: 'DXB',
      price: 500,
      duration: 120,
      stops: 0,
      airline: 'SV',
      departureTime: '2026-08-01T08:00:00Z',
      arrivalTime: '2026-08-01T10:00:00Z',
    }, 0)
    const amadeusFlight: UnifiedFlight = { ...amadeus, provider: 'amadeus', id: 'amd' }
    const mockDup: UnifiedFlight = {
      ...amadeusFlight,
      id: 'mock_dup',
      provider: 'mock',
      price: 999,
    }
    const other = enrichMockFlight({
      origin: 'RUH',
      destination: 'DXB',
      price: 400,
      duration: 200,
      stops: 1,
      airline: 'F3',
      departureTime: '2026-08-01T14:00:00Z',
      arrivalTime: '2026-08-01T18:00:00Z',
    }, 1)
    const deduped = dedupeFlights([mockDup, other, amadeusFlight])
    expect(deduped).toHaveLength(2)
    const kept = deduped.find((f) => f.airline === 'SV' && f.stops === 0)
    expect(kept?.provider).toBe('amadeus')
    expect(kept?.price).toBe(500)
  })

  it('applies filters', () => {
    const filtered = applyFlightFilters(sampleFlights(), {
      maxPrice: 450,
      maxStops: 0,
      refundableOnly: true,
      baggageIncluded: true,
    })
    expect(filtered.every((f) => f.price <= 450 && f.stops <= 0 && f.refundable && f.baggage)).toBe(true)
  })

  it('sorts by price, duration, departure, arrival', () => {
    const flights = sampleFlights()
    expect(sortFlights(flights, 'lowest_price')[0]?.price).toBeLessThanOrEqual(
      sortFlights(flights, 'lowest_price')[1]?.price ?? Infinity,
    )
    expect(sortFlights(flights, 'shortest_duration')[0]?.duration).toBeLessThanOrEqual(
      sortFlights(flights, 'shortest_duration')[1]?.duration ?? Infinity,
    )
    const earliestDep = sortFlights(flights, 'earliest_departure')
    expect(Date.parse(earliestDep[0]!.departureTime)).toBeLessThanOrEqual(
      Date.parse(earliestDep[1]!.departureTime),
    )
    const earliestArr = sortFlights(flights, 'earliest_arrival')
    expect(Date.parse(earliestArr[0]!.arrivalTime)).toBeLessThanOrEqual(
      Date.parse(earliestArr[1]!.arrivalTime),
    )
  })

  it('supports cursor pagination', () => {
    const flights = sampleFlights()
    const first = paginateFlights(flights, 2, null)
    expect(first.page).toHaveLength(2)
    expect(first.hasMore).toBe(true)
    expect(first.nextCursor).toBeTruthy()
    expect(decodeFlightCursor(first.nextCursor)).toBe(2)
    const second = paginateFlights(flights, 2, first.nextCursor)
    expect(second.page[0]?.id).not.toBe(first.page[0]?.id)
    expect(encodeFlightCursor(0)).toBeTruthy()
  })

  it('returns diagnostics without secrets', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })
    const page = await engine.searchFlights({
      origin: 'RUH',
      destination: 'CAI',
      departureDate: '2026-10-01',
      pageSize: 5,
    })
    const json = JSON.stringify(page.diagnostics)
    expect(json).not.toMatch(/sk_|secret_|token_|password/i)
    expect(page.diagnostics).toHaveProperty('providerLatencyMs')
    expect(page.diagnostics).toHaveProperty('fallbackUsed')
    expect(page.diagnostics).toHaveProperty('cacheHit')
  })

  it('normalizes live-shaped offers and uses registry mock/live modes', async () => {
    const normalized = normalizeFlightOffer({
      id: 'amd_1',
      providerId: 'amadeus',
      from: 'RUH',
      to: 'DXB',
      airline: 'SV',
      cabin: 'ECONOMY',
      stops: 0,
      durationMinutes: 130,
      departureAt: '2026-08-01T09:00:00Z',
      arrivalAt: '2026-08-01T11:10:00Z',
      price: { amount: 480, currency: 'SAR' },
      refundable: true,
    })
    expect(normalized?.provider).toBe('amadeus')
    expect(normalized?.cabin).toBe('economy')

    const registry = createProviderRuntimeRegistry({ forceMock: true })
    const engine = createFlightSearchEngine({ registry })
    const page = await engine.searchFlights({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-08-01',
    })
    expect(page.diagnostics.modes.mock === 'mock' || page.flights.length > 0).toBe(true)
  })

  it('automatic failover yields results without user-facing failure', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })
    const page = await engine.searchFlights({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-12-01',
      sort: 'lowest_price',
      filters: { maxStops: 2 },
    })
    expect(page.flights.length).toBeGreaterThan(0)
    expect(page.total).toBeGreaterThan(0)
  })
})
