/**
 * Sprint 114 — Intelligent Itinerary Engine production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import type { RahhalFlightSearchOffer } from '../agent/liveFlightSearch/types'
import type { HotelOffer } from '../agent/liveHotelSearch/types'
import type { TripCandidate } from '../agent/tripBuilder/types'
import {
  SPRINT114_ITINERARY_ENGINE_VERSION,
  ITINERARY_ENGINE_FEATURE_ID,
  isItineraryEngineEnabled,
  runItineraryEngine,
  createItineraryEngine,
  createItineraryRunner,
  planDays,
  normalizeItineraryContext,
  planMeals,
  planTransfers,
  allocateActivities,
  planInterCityTransfer,
  buildDayTimeline,
  detectConflicts,
  resolveConflicts,
  scoreItinerary,
  explainItinerary,
  buildItineraryMetadata,
  dayPartForMinutes,
  type ItineraryEngineInput,
  type ItineraryDayPlan,
  type ItineraryTimeBlock,
} from '../agent/itinerary'

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

function stubTrip(overrides?: Partial<TripCandidate>): TripCandidate {
  const f = flight()
  const h = hotel()
  return {
    id: 'trip_stub',
    title: 'Stub Dubai',
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

function baseInput(overrides?: Partial<ItineraryEngineInput>): ItineraryEngineInput {
  return {
    conversationId: 'conv_114',
    trip: stubTrip(),
    style: 'leisure',
    adults: 2,
    children: 0,
    interests: ['culture', 'food'],
    ...overrides,
  }
}

function enabled(input: ItineraryEngineInput = baseInput()) {
  return runItineraryEngine(input, { enabled: true })
}

describe('Sprint 114 — Intelligent Itinerary Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT114_ITINERARY_ENGINE_VERSION).toMatch(/itinerary-engine/)
    expect(ITINERARY_ENGINE_FEATURE_ID).toBe('ai.itinerary_engine')
    expect(getFeatureRegistry().isEnabled('ai.itinerary_engine')).toBe(false)
    expect(isItineraryEngineEnabled()).toBe(false)
  })

  describe('feature flag OFF/ON', () => {
    it('OFF returns disabled legacy result without building days', () => {
      const result = runItineraryEngine(baseInput())
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.days).toEqual([])
      expect(result.logs).toContain('itinerary_engine_disabled')
    })

    it('ON builds itinerary via options override', () => {
      const result = enabled()
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.empty).toBe(false)
      expect(result.days.length).toBeGreaterThanOrEqual(3)
      expect(result.logs).toContain('itinerary_engine_enabled')
    })

    it('ON via registry enable', () => {
      getFeatureRegistry().setEnabled('ai.itinerary_engine', true)
      expect(isItineraryEngineEnabled()).toBe(true)
      const result = runItineraryEngine(baseInput())
      expect(result.enabled).toBe(true)
      expect(result.days.length).toBeGreaterThan(0)
    })

    it('createItineraryEngine / runner honor enabled option', () => {
      const engine = createItineraryEngine({ enabled: true })
      const runner = createItineraryRunner({ enabled: true })
      expect(engine.run(baseInput()).enabled).toBe(true)
      expect(runner(baseInput()).days.length).toBeGreaterThan(0)
    })
  })

  describe('single city', () => {
    it('builds arrival, full, and departure days for one city', () => {
      const result = enabled()
      expect(result.days.every((d) => d.city === 'DXB' || d.city.length > 0)).toBe(true)
      expect(result.days[0]?.isArrivalDay).toBe(true)
      expect(result.days[result.days.length - 1]?.isDepartureDay).toBe(true)
      const arrival = result.days[0]!
      expect(arrival.blocks.some((b) => b.kind === 'flight_arrival')).toBe(true)
      expect(arrival.blocks.some((b) => b.kind === 'hotel_check_in')).toBe(true)
      expect(arrival.blocks.some((b) => b.kind === 'transfer')).toBe(true)
    })
  })

  describe('multi city', () => {
    it('assigns cities by stay dates and inserts inter-city transfer', () => {
      const result = enabled({
        trip: stubTrip({
          destination: 'DXB',
          departureDate: '2026-09-15',
          returnDate: '2026-09-20',
          checkInDate: '2026-09-15',
          checkOutDate: '2026-09-20',
        }),
        cities: [
          {
            city: 'Dubai',
            arriveDate: '2026-09-15',
            departDate: '2026-09-17',
            hotel: hotel(),
          },
          {
            city: 'Abu Dhabi',
            arriveDate: '2026-09-18',
            departDate: '2026-09-20',
            hotel: hotel({ hotelName: 'Corniche Stay', city: 'Abu Dhabi' }),
          },
        ],
      })
      const cities = new Set(result.days.map((d) => d.city))
      expect(cities.has('Dubai')).toBe(true)
      expect(cities.has('Abu Dhabi')).toBe(true)
      const inter = result.timeline.find(
        (b) => b.kind === 'transfer' && /Abu Dhabi|→/.test(b.title),
      )
      expect(inter).toBeTruthy()
      expect(result.metadata.cityCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('business trip', () => {
    it('allocates business meetings and scores business suitability', () => {
      const result = enabled({
        style: 'business',
        trip: stubTrip({ labels: ['best_business'] }),
      })
      expect(result.metadata.style).toBe('business')
      const meetings = result.timeline.filter((b) => b.kind === 'business_meeting')
      expect(meetings.length).toBeGreaterThan(0)
      expect(result.scores.businessSuitability).toBeGreaterThanOrEqual(50)
      expect(result.explanation.orderingReasons.some((r) => /Business/i.test(r))).toBe(
        true,
      )
    })
  })

  describe('family vacation', () => {
    it('favors family-friendly activities and free time', () => {
      const result = enabled({
        style: 'family',
        children: 2,
        adults: 2,
        trip: stubTrip({ labels: ['best_family'] }),
      })
      expect(result.metadata.style).toBe('family')
      expect(result.scores.familyFriendliness).toBeGreaterThanOrEqual(50)
      const free = result.timeline.filter((b) => b.kind === 'free_time')
      expect(free.length + result.metadata.freeHours).toBeGreaterThan(0)
    })
  })

  describe('flight delays and late arrivals', () => {
    it('applies arrivalDelayMinutes into arrival block timing', () => {
      const result = enabled({
        arrivalDelayMinutes: 90,
        trip: stubTrip({
          flight: flight({ arrivalAt: '2026-09-15T20:00:00Z' }),
        }),
      })
      const arrival = result.days[0]?.blocks.find((b) => b.kind === 'flight_arrival')
      expect(arrival).toBeTruthy()
      // 20:00 = 1200 + 90 delay = 1290
      expect(arrival!.startMinutes).toBe(20 * 60 + 90)
      expect(result.explanation.flightFit).toMatch(/delay/i)
    })

    it('late arrival strips evening sightseeing after conflict resolve', () => {
      const result = enabled({
        trip: stubTrip({
          flight: flight({ arrivalAt: '2026-09-15T22:30:00Z' }),
        }),
      })
      const arrival = result.days[0]?.blocks.find((b) => b.kind === 'flight_arrival')
      expect(arrival!.startMinutes).toBeGreaterThanOrEqual(22 * 60)
      const eveningSightseeing = result.days[0]?.blocks.filter(
        (b) =>
          (b.kind === 'sightseeing' || b.kind === 'activity')
          && b.dayPart === 'evening',
      )
      expect(eveningSightseeing?.length ?? 0).toBe(0)
      expect(
        result.conflicts.some((c) => c.kind === 'late_arrival' && c.resolved),
      ).toBe(true)
    })
  })

  describe('hotel conflicts', () => {
    it('resolves check-in before arrival by deferring check-in', () => {
      const norm = normalizeItineraryContext(baseInput())
      expect(norm.ok).toBe(true)
      if (!norm.ok) return
      const days = planDays(norm.ctx)
      const day = days[0]!
      const badCheckIn: ItineraryTimeBlock = {
        id: 'bad_ci',
        kind: 'hotel_check_in',
        dayPart: 'morning',
        title: 'Early check-in',
        startMinutes: 8 * 60,
        endMinutes: 8 * 60 + 45,
        durationMinutes: 45,
        location: 'Hotel',
        notes: [],
        why: 'test',
      }
      const arrival: ItineraryTimeBlock = {
        id: 'arr',
        kind: 'flight_arrival',
        dayPart: 'afternoon',
        title: 'Arrive',
        startMinutes: 14 * 60,
        endMinutes: 14 * 60 + 30,
        durationMinutes: 30,
        location: 'DXB',
        notes: [],
        why: 'test',
      }
      const tainted: ItineraryDayPlan = {
        ...day,
        blocks: [badCheckIn, arrival],
        morning: [badCheckIn],
        afternoon: [arrival],
        evening: [],
        night: [],
      }
      const before = detectConflicts([tainted])
      expect(before.some((c) => c.kind === 'missed_check_in')).toBe(true)
      const { days: fixed, conflicts } = resolveConflicts([tainted])
      const ci = fixed[0]!.blocks.find((b) => b.kind === 'hotel_check_in')!
      const arr = fixed[0]!.blocks.find((b) => b.kind === 'flight_arrival')!
      expect(ci.startMinutes).toBeGreaterThanOrEqual(arr.endMinutes)
      expect(conflicts.some((c) => c.kind === 'missed_check_in' && c.resolved)).toBe(
        true,
      )
    })
  })

  describe('empty itinerary', () => {
    it('validation failure yields empty enabled result', () => {
      const result = runItineraryEngine(
        { destination: '', departureDate: '' },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.days).toEqual([])
    })
  })

  describe('timeline generation', () => {
    it('partitions morning/afternoon/evening/night', () => {
      const result = enabled()
      for (const day of result.days) {
        for (const b of day.blocks) {
          expect(b.dayPart).toBe(dayPartForMinutes(b.startMinutes))
        }
        const ids = new Set(day.blocks.map((b) => b.id))
        for (const part of [
          ...day.morning,
          ...day.afternoon,
          ...day.evening,
          ...day.night,
        ]) {
          expect(ids.has(part.id)).toBe(true)
        }
      }
      expect(result.timeline.length).toBe(
        result.days.reduce((s, d) => s + d.blocks.length, 0),
      )
    })

    it('buildDayTimeline sorts by startMinutes', () => {
      const norm = normalizeItineraryContext(baseInput())
      expect(norm.ok).toBe(true)
      if (!norm.ok) return
      const day = planDays(norm.ctx)[0]!
      const a: ItineraryTimeBlock = {
        id: 'b2',
        kind: 'meal',
        dayPart: 'afternoon',
        title: 'Lunch',
        startMinutes: 13 * 60,
        endMinutes: 14 * 60,
        durationMinutes: 60,
        location: null,
        notes: [],
        why: 'x',
      }
      const b: ItineraryTimeBlock = {
        id: 'b1',
        kind: 'meal',
        dayPart: 'morning',
        title: 'Breakfast',
        startMinutes: 8 * 60,
        endMinutes: 9 * 60,
        durationMinutes: 60,
        location: null,
        notes: [],
        why: 'x',
      }
      const built = buildDayTimeline(day, [a, b])
      expect(built.blocks[0]!.title).toBe('Breakfast')
      expect(built.morning).toHaveLength(1)
      expect(built.afternoon).toHaveLength(1)
    })
  })

  describe('meal allocation', () => {
    it('places breakfast/lunch/dinner away from occupied windows', () => {
      const norm = normalizeItineraryContext(baseInput())
      expect(norm.ok).toBe(true)
      if (!norm.ok) return
      const day = planDays(norm.ctx)[1] ?? planDays(norm.ctx)[0]!
      const meals = planMeals({
        day: { ...day, isArrivalDay: false, isDepartureDay: false },
        style: 'leisure',
        occupied: [{ start: 13 * 60, end: 14 * 60 }],
      })
      expect(meals.some((m) => m.title === 'Breakfast')).toBe(true)
      expect(meals.some((m) => m.title === 'Lunch')).toBe(false)
      expect(meals.some((m) => m.title === 'Dinner')).toBe(true)
    })
  })

  describe('transfer allocation', () => {
    it('plans airport transfers on arrival and departure days', () => {
      const norm = normalizeItineraryContext(baseInput())
      expect(norm.ok).toBe(true)
      if (!norm.ok) return
      const days = planDays(norm.ctx)
      const arr = planTransfers({
        day: days[0]!,
        ctx: norm.ctx,
        arrivalMinutes: 11 * 60 + 30,
      })
      expect(arr.some((b) => b.kind === 'flight_arrival')).toBe(true)
      expect(arr.some((b) => /Airport → hotel/i.test(b.title))).toBe(true)

      const dep = planTransfers({
        day: days[days.length - 1]!,
        ctx: norm.ctx,
        arrivalMinutes: 11 * 60,
      })
      expect(dep.some((b) => b.kind === 'flight_departure')).toBe(true)
      expect(dep.some((b) => /Hotel → airport/i.test(b.title))).toBe(true)

      const inter = planInterCityTransfer({
        day: { ...days[1]!, city: 'Abu Dhabi' },
        previousCity: 'Dubai',
      })
      expect(inter).toHaveLength(1)
      expect(inter[0]!.kind).toBe('transfer')
    })
  })

  describe('activity ordering', () => {
    it('orders activities after transfers and keeps chronological blocks', () => {
      const result = enabled()
      for (const day of result.days) {
        for (let i = 1; i < day.blocks.length; i++) {
          expect(day.blocks[i]!.startMinutes).toBeGreaterThanOrEqual(
            day.blocks[i - 1]!.startMinutes,
          )
        }
      }
      const n = normalizeItineraryContext(baseInput())
      expect(n.ok).toBe(true)
      if (!n.ok) return
      const mid =
        result.days.find((d) => !d.isArrivalDay && !d.isDepartureDay) ?? result.days[0]!
      const acts = allocateActivities({
        day: { ...mid, blocks: [] },
        ctx: n.ctx,
        occupied: [],
      })
      expect(acts.length).toBeGreaterThan(0)
      const starts = acts.map((a) => a.startMinutes)
      expect([...starts].sort((a, b) => a - b)).toEqual(starts)
    })
  })

  describe('confidence and metadata', () => {
    it('produces confidence and metadata fields', () => {
      const result = enabled()
      expect(result.metadata.confidence).toBeGreaterThan(0.2)
      expect(result.metadata.confidence).toBeLessThanOrEqual(0.98)
      expect(result.metadata.dayCount).toBe(result.days.length)
      expect(result.metadata.hotelNights).toBeGreaterThanOrEqual(0)
      expect(result.metadata.flightDurationMinutes).toBe(210)
      expect(result.metadata.activityCount).toBeGreaterThanOrEqual(0)
      expect(typeof result.metadata.freeHours).toBe('number')
      expect(typeof result.metadata.totalTravelTimeMinutes).toBe('number')
      expect(result.scores.overallQuality).toBeGreaterThan(0)
      expect(result.explanation.summary.length).toBeGreaterThan(0)
      expect(result.explanation.hotelFit).toMatch(/Marina Hotel|hotel/i)
      expect(result.explanation.flightFit.length).toBeGreaterThan(0)
    })

    it('scoreItinerary / explain / metadata helpers work on built days', () => {
      const result = enabled()
      const n = normalizeItineraryContext(baseInput())
      expect(n.ok).toBe(true)
      if (!n.ok) return
      const scores = scoreItinerary(result.days, n.ctx)
      const explanation = explainItinerary(result.days, n.ctx, 0)
      const meta = buildItineraryMetadata(result.days, n.ctx, scores, 0, 0)
      expect(scores.comfort).toBeGreaterThanOrEqual(0)
      expect(explanation.activityReasons.length).toBeGreaterThanOrEqual(0)
      expect(meta.cityCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('overlapping conflict resolution', () => {
    it('shifts soft overlapping blocks', () => {
      const norm = normalizeItineraryContext(baseInput())
      expect(norm.ok).toBe(true)
      if (!norm.ok) return
      const day = planDays(norm.ctx)[0]!
      const a: ItineraryTimeBlock = {
        id: 'a',
        kind: 'sightseeing',
        dayPart: 'afternoon',
        title: 'A',
        startMinutes: 14 * 60,
        endMinutes: 16 * 60,
        durationMinutes: 120,
        location: null,
        notes: [],
        why: 'x',
      }
      const b: ItineraryTimeBlock = {
        id: 'b',
        kind: 'meal',
        dayPart: 'afternoon',
        title: 'B',
        startMinutes: 15 * 60,
        endMinutes: 16 * 60,
        durationMinutes: 60,
        location: null,
        notes: [],
        why: 'x',
      }
      const { days, conflicts } = resolveConflicts([
        { ...day, blocks: [a, b], morning: [], afternoon: [a, b], evening: [], night: [] },
      ])
      expect(conflicts.some((c) => c.resolved)).toBe(true)
      const blocks = days[0]!.blocks
      expect(blocks[0]!.endMinutes).toBeLessThanOrEqual(blocks[1]!.startMinutes)
    })
  })
})
