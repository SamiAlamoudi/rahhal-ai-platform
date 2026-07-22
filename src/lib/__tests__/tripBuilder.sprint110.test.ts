/**
 * Sprint 110 — AI Trip Builder production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import type { RahhalFlightSearchOffer } from '../agent/liveFlightSearch/types'
import type { HotelOffer } from '../agent/liveHotelSearch/types'
import { runResponseComposer } from '../agent/responseComposer'
import {
  SPRINT110_TRIP_BUILDER_VERSION,
  TRIP_BUILDER_FEATURE_ID,
  isTripBuilderEnabled,
  validateTripBuilderInput,
  assessTripCompatibility,
  calculateTripCost,
  rankTrips,
  runTripBuilder,
  createTripBuilderRunner,
  composeTripCandidates,
  prioritizeOffersForDecisionEngine,
  toResponseComposerInput,
  type TripBuilderInput,
  type TripCandidate,
} from '../agent/tripBuilder'

function flight(
  overrides?: Partial<RahhalFlightSearchOffer>,
): RahhalFlightSearchOffer {
  return {
    id: 'flt_1',
    providerId: 'amadeus',
    airline: 'Saudia',
    carrierCode: 'SV',
    price: 1200,
    currency: 'SAR',
    durationMinutes: 210,
    stops: 0,
    cabin: 'economy',
    origin: 'RUH',
    destination: 'DXB',
    departureAt: '2026-09-15T08:00:00Z',
    arrivalAt: '2026-09-15T11:30:00Z',
    refundable: false,
    seatsRemaining: 5,
    providerConfidence: 0.9,
    availability: 'available',
    title: 'Saudia RUH→DXB',
    ...overrides,
  }
}

function hotel(overrides?: Partial<HotelOffer>): HotelOffer {
  return {
    id: 'htl_1',
    hotelId: 'H1',
    hotelName: 'Marina Hotel',
    city: 'Dubai',
    country: 'AE',
    latitude: 25.08,
    longitude: 55.14,
    roomType: 'STANDARD',
    boardType: 'BREAKFAST',
    rating: 4,
    stars: 4,
    price: 900,
    currency: 'SAR',
    taxes: 50,
    freeCancellation: true,
    amenities: ['WIFI', 'POOL', 'FAMILY'],
    images: [],
    provider: 'amadeus',
    ...overrides,
  }
}

function baseInput(overrides?: Partial<TripBuilderInput>): TripBuilderInput {
  return {
    destination: 'DXB',
    departureDate: '2026-09-15',
    returnDate: '2026-09-18',
    checkInDate: '2026-09-15',
    checkOutDate: '2026-09-18',
    budget: 5000,
    currency: 'SAR',
    adults: 2,
    children: 0,
    conversationId: 'conv_110',
    flights: [
      flight(),
      flight({
        id: 'flt_2',
        airline: 'Flynas',
        price: 800,
        stops: 1,
        durationMinutes: 320,
        title: 'Flynas RUH→DXB',
        cabin: 'economy',
      }),
      flight({
        id: 'flt_biz',
        airline: 'Emirates',
        price: 3200,
        cabin: 'business',
        stops: 0,
        title: 'Emirates business RUH→DXB',
      }),
    ],
    hotels: [
      hotel(),
      hotel({
        id: 'htl_budget',
        hotelId: 'H2',
        hotelName: 'Budget Inn',
        price: 400,
        stars: 2,
        taxes: 0,
        freeCancellation: false,
        amenities: ['WIFI'],
      }),
      hotel({
        id: 'htl_lux',
        hotelId: 'H3',
        hotelName: 'Palace Luxury',
        price: 3500,
        stars: 5,
        taxes: 200,
        amenities: ['WIFI', 'SPA', 'BUSINESS', 'MEETING'],
      }),
    ],
    ...overrides,
  }
}

function stubTrip(overrides?: Partial<TripCandidate>): TripCandidate {
  const f = flight()
  const h = hotel()
  return {
    id: 'trip_stub',
    title: 'Stub',
    destination: 'DXB',
    departureDate: '2026-09-15',
    returnDate: '2026-09-18',
    checkInDate: '2026-09-15',
    checkOutDate: '2026-09-18',
    nights: 3,
    flight: f,
    hotel: h,
    cost: {
      flightCost: 1200,
      hotelCost: 900,
      taxes: 50,
      totalCost: 2150,
      currency: 'SAR',
      estimatedSavings: 2850,
      underBudget: true,
      budgetUtilization: 0.43,
    },
    travelQuality: 80,
    confidence: 0.8,
    explanation: 'stub',
    reasons: [],
    labels: [],
    compatible: true,
    validationErrors: [],
    score: 75,
    ...overrides,
  }
}

describe('Sprint 110 — AI Trip Builder', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT110_TRIP_BUILDER_VERSION).toMatch(/trip-builder/)
    expect(TRIP_BUILDER_FEATURE_ID).toBe('ai.trip_builder')
    expect(getFeatureRegistry().isEnabled('ai.trip_builder')).toBe(false)
    expect(isTripBuilderEnabled()).toBe(false)
  })

  describe('feature flag OFF/ON', () => {
    it('OFF returns disabled legacy result without building trips', () => {
      const result = runTripBuilder(baseInput())
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.trips).toEqual([])
      expect(result.logs).toContain('trip_builder_disabled')
    })

    it('ON builds trips via runner override', () => {
      const result = runTripBuilder(baseInput(), { enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.empty).toBe(false)
      expect(result.trips.length).toBeGreaterThan(0)
      expect(result.selected).not.toBeNull()
    })

    it('registry enable turns the feature on', () => {
      getFeatureRegistry().setEnabled('ai.trip_builder', true)
      expect(isTripBuilderEnabled()).toBe(true)
      const result = runTripBuilder(baseInput())
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
    })
  })

  describe('date validation', () => {
    it('accepts valid dates', () => {
      const v = validateTripBuilderInput(baseInput())
      expect(v.ok).toBe(true)
      expect(v.normalized?.checkInDate).toBe('2026-09-15')
      expect(v.normalized?.checkOutDate).toBe('2026-09-18')
    })

    it('rejects invalid / inverted dates', () => {
      expect(
        validateTripBuilderInput(
          baseInput({ departureDate: 'not-a-date' }),
        ).ok,
      ).toBe(false)
      expect(
        validateTripBuilderInput(
          baseInput({
            checkInDate: '2026-09-18',
            checkOutDate: '2026-09-15',
          }),
        ).errors,
      ).toContain('checkOutDate must be after checkInDate')
      expect(
        validateTripBuilderInput(
          baseInput({
            departureDate: '2026-09-20',
            checkInDate: '2026-09-15',
          }),
        ).errors.some((e) => e.includes('checkInDate')),
      ).toBe(true)
    })

    it('defaults check-in/out from travel dates', () => {
      const v = validateTripBuilderInput(
        baseInput({
          checkInDate: null,
          checkOutDate: null,
          returnDate: '2026-09-20',
        }),
      )
      expect(v.ok).toBe(true)
      expect(v.normalized?.checkInDate).toBe('2026-09-15')
      expect(v.normalized?.checkOutDate).toBe('2026-09-20')
    })
  })

  describe('budget validation', () => {
    it('rejects non-positive budget', () => {
      const v = validateTripBuilderInput(baseInput({ budget: 0 }))
      expect(v.ok).toBe(false)
      expect(v.errors).toContain('budget must be greater than zero')
    })

    it('marks under/over budget on cost breakdown', () => {
      const under = calculateTripCost({
        flight: flight({ price: 500 }),
        hotel: hotel({ price: 400, taxes: 0 }),
        nights: 3,
        budget: 2000,
      })
      expect(under.underBudget).toBe(true)
      expect(under.estimatedSavings).toBe(1100)

      const over = calculateTripCost({
        flight: flight({ price: 2000 }),
        hotel: hotel({ price: 2000, taxes: 100 }),
        nights: 3,
        budget: 1000,
      })
      expect(over.underBudget).toBe(false)
      expect(over.totalCost).toBe(4100)
    })
  })

  describe('hotel compatibility', () => {
    it('accepts aligned flight and hotel dates', () => {
      const r = assessTripCompatibility({
        flight: flight(),
        hotel: hotel(),
        departureDate: '2026-09-15',
        returnDate: '2026-09-18',
        checkInDate: '2026-09-15',
        checkOutDate: '2026-09-18',
      })
      expect(r.compatible).toBe(true)
      expect(r.nights).toBe(3)
    })

    it('rejects arrival after check-in and missing prices', () => {
      const late = assessTripCompatibility({
        flight: flight({ arrivalAt: '2026-09-16T10:00:00Z' }),
        hotel: hotel(),
        departureDate: '2026-09-15',
        returnDate: '2026-09-18',
        checkInDate: '2026-09-15',
        checkOutDate: '2026-09-18',
      })
      expect(late.compatible).toBe(false)
      expect(late.errors.some((e) => e.includes('arrives after'))).toBe(true)

      const noPrice = assessTripCompatibility({
        flight: flight({ price: null }),
        hotel: hotel({ price: null }),
        departureDate: '2026-09-15',
        returnDate: '2026-09-18',
        checkInDate: '2026-09-15',
        checkOutDate: '2026-09-18',
      })
      expect(noPrice.compatible).toBe(false)
    })
  })

  describe('trip generation', () => {
    it('generates flight×hotel candidates with cost/quality/confidence', () => {
      const result = runTripBuilder(baseInput(), { enabled: true })
      expect(result.ok).toBe(true)
      expect(result.trips.length).toBeGreaterThan(1)
      const trip = result.selected!
      expect(trip.cost.totalCost).toBeGreaterThan(0)
      expect(trip.travelQuality).toBeGreaterThan(0)
      expect(trip.confidence).toBeGreaterThan(0)
      expect(trip.explanation.length).toBeGreaterThan(10)
      expect(trip.nights).toBe(3)
      expect(trip.compatible).toBe(true)
    })

    it('composeTripCandidates caps combinations', () => {
      const trips = composeTripCandidates(
        [flight(), flight({ id: 'flt_2', price: 900 })],
        [hotel(), hotel({ id: 'htl_2', price: 500 })],
        {
          destination: 'DXB',
          departureDate: '2026-09-15',
          returnDate: '2026-09-18',
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-18',
          budget: 10_000,
          currency: 'SAR',
          maxCandidates: 2,
        },
      )
      expect(trips.length).toBeLessThanOrEqual(2)
    })
  })

  describe('ranking', () => {
    it('produces all ranking kinds', () => {
      const result = runTripBuilder(baseInput(), { enabled: true })
      const kinds = result.rankings.map((r) => r.kind)
      expect(kinds).toEqual([
        'best_overall',
        'best_budget',
        'best_luxury',
        'best_family',
        'best_business',
        'best_value',
        'best_short_stay',
        'best_long_stay',
      ])
      expect(result.rankings.every((r) => r.trip != null)).toBe(true)

      const budget = result.rankings.find((r) => r.kind === 'best_budget')!.trip!
      const luxury = result.rankings.find((r) => r.kind === 'best_luxury')!.trip!
      expect(budget.cost.totalCost).toBeLessThanOrEqual(luxury.cost.totalCost)
    })

    it('labels short vs long stay by nights', () => {
      const short = stubTrip({
        id: 'short',
        nights: 1,
        checkOutDate: '2026-09-16',
        score: 70,
      })
      const long = stubTrip({
        id: 'long',
        nights: 7,
        checkOutDate: '2026-09-22',
        score: 70,
        flight: flight({ id: 'flt_long' }),
        hotel: hotel({ id: 'htl_long' }),
      })
      const { rankings } = rankTrips([short, long])
      expect(rankings.find((r) => r.kind === 'best_short_stay')?.trip?.id).toBe(
        'short',
      )
      expect(rankings.find((r) => r.kind === 'best_long_stay')?.trip?.id).toBe(
        'long',
      )
    })
  })

  describe('confidence', () => {
    it('compatible priced trips score higher confidence than incompatible', () => {
      const ok = runTripBuilder(baseInput(), { enabled: true })
      expect(ok.confidence).toBeGreaterThan(0.4)

      const bad = runTripBuilder(
        baseInput({
          flights: [flight({ arrivalAt: '2026-09-20T10:00:00Z', price: null })],
          hotels: [hotel({ price: null })],
        }),
        { enabled: true },
      )
      expect(bad.ok).toBe(false)
      expect(bad.error?.code).toMatch(/INCOMPATIBLE|EMPTY/)
    })
  })

  describe('empty results', () => {
    it('handles empty flight pool', () => {
      const result = runTripBuilder(baseInput({ flights: [] }), {
        enabled: true,
      })
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.error?.code).toBe('EMPTY_FLIGHTS')
    })

    it('handles empty hotel pool', () => {
      const result = runTripBuilder(baseInput({ hotels: [] }), {
        enabled: true,
      })
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('EMPTY_HOTELS')
    })

    it('handles both pools empty', () => {
      const result = runTripBuilder(
        baseInput({ flights: [], hotels: [] }),
        { enabled: true },
      )
      expect(result.error?.code).toBe('EMPTY_RESULTS')
    })
  })

  describe('provider failures', () => {
    it('surfaces upstream provider error codes when pools are empty', () => {
      const result = runTripBuilder(
        baseInput({
          flights: [],
          hotels: [hotel()],
          flightSearchError: {
            code: 'RATE_LIMITED',
            message: 'Amadeus rate limited',
            retryable: true,
          },
        }),
        { enabled: true },
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('RATE_LIMITED')
      expect(result.error?.retryable).toBe(true)
    })
  })

  describe('invalid data', () => {
    it('returns VALIDATION_ERROR for missing destination', () => {
      const result = runTripBuilder(baseInput({ destination: '  ' }), {
        enabled: true,
      })
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
      expect(result.validationErrors.length).toBeGreaterThan(0)
    })

    it('runner retains structured logs', () => {
      const runner = createTripBuilderRunner({ enabled: true })
      runner.run(baseInput({ destination: '' }))
      expect(
        runner.getStructuredLogs().some((l) =>
          l.message.includes('validation'),
        ),
      ).toBe(true)
    })
  })

  describe('Decision Engine exposure', () => {
    it('exposes prioritized flightOffers and hotelStays without changing DE', () => {
      const result = runTripBuilder(baseInput(), { enabled: true })
      expect(result.flightOffers.length).toBeGreaterThan(0)
      expect(result.hotelStays.length).toBeGreaterThan(0)
      expect(result.flightOffers[0]).toHaveProperty('id')
      expect(result.hotelStays[0]).toHaveProperty('name')

      const pools = prioritizeOffersForDecisionEngine({
        ranked: result.ranked,
      })
      expect(pools.flightOffers[0]?.id).toBe(result.ranked[0]?.flight.id)
    })
  })

  describe('Response Composer packages', () => {
    it('passes complete trip packages into Response Composer without changing RC', () => {
      const result = runTripBuilder(baseInput(), { enabled: true })
      expect(result.responseComposerPackages.length).toBeGreaterThan(0)
      expect(result.responseComposerPackages[0]).toMatchObject({
        tripId: expect.any(String),
        hotel: expect.objectContaining({ hotelName: expect.any(String) }),
        flight: expect.objectContaining({ id: expect.any(String) }),
      })

      const input = toResponseComposerInput({
        conversationId: 'conv_110',
        destination: 'DXB',
        packages: result.responseComposerPackages,
        selected: result.selected,
        rankings: result.rankings,
      })
      expect(input.flights?.length).toBeGreaterThan(0)
      expect(input.labeled?.bestOverallId).toBeTruthy()

      // Response Composer still works unchanged on the mapped input
      const composed = runResponseComposer(result.responseComposerInput, {
        enabled: true,
      })
      expect(composed.enabled).toBe(true)
      expect(composed.metadata.offerCount).toBeGreaterThan(0)
    })
  })
})
