/**
 * Sprint 11 — Flight Results Experience (sort, filter, recommendation, selection).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { TravelSearchRequest } from '../../utils/travelSearchRequest'
import {
  buildFlightRecommendationSummary,
  createSessionFromFlightSelection,
  emptyFlightFilters,
  extractAirlineCode,
  filterFlights,
  formatFlightDuration,
  onlyFlights,
  sortFlights,
  toFlightResultViewModel,
  uniqueAirlines,
} from '../flightResults'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { resetBookingOrchestrator, clearLocalBookingSessions } from '../booking'

function flight(
  id: string,
  overrides: Partial<NormalizedTravelOption> & {
    airline?: string
    departureTime?: string
    arrivalTime?: string
    cabin?: string
  } = {},
): NormalizedTravelOption {
  const {
    airline = 'Saudia',
    departureTime = '2026-11-10T08:00:00',
    arrivalTime = '2026-11-10T11:00:00',
    cabin = 'economy',
    ...rest
  } = overrides
  const base: NormalizedTravelOption = {
    id,
    type: 'flight',
    title: `${airline} ${id}`,
    providerIds: ['amadeus-flight-001'],
    price: rest.price ?? 1000,
    currency: 'SAR',
    durationMinutes: rest.durationMinutes ?? 180,
    stops: rest.stops ?? 0,
    rating: 4,
    location: 'DXB',
    baggageIncluded: true,
    familyFriendly: true,
    refundable: false,
    attributes: {
      airline,
      flightNumber: 'SV568',
      origin: 'RUH',
      destination: 'DXB',
      departureTime,
      arrivalTime,
      cabin,
      segments: JSON.stringify([
        {
          origin: 'RUH',
          destination: 'DXB',
          departure: departureTime,
          arrival: arrivalTime,
          carrier: airline,
          flightNumber: 'SV568',
          aircraft: 'A320',
          cabin,
          durationMinutes: rest.durationMinutes ?? 180,
          departureTerminal: '1',
          arrivalTerminal: '3',
          operatingCarrier: airline,
          fareFamily: 'Saver',
          bookingClass: 'Y',
        },
      ]),
      fareFamily: 'Saver',
      bookingClass: 'Y',
      aircraft: 'A320',
      cancellationPolicy: 'non-refundable',
    },
    decisionScore: rest.decisionScore ?? {
      weightedAverage: 90,
      confidence: 0.8,
      categories: [],
      reasons: [],
      recommendation: 'recommended',
    },
    recommendationLevel: 'recommended',
    reasons: [],
    ...rest,
  }
  return { ...base, type: 'flight' }
}

function searchRequest(): TravelSearchRequest {
  return {
    destination: 'Dubai',
    departureCity: 'Riyadh',
    departureDate: '2026-11-10',
    returnDate: '2026-11-20',
    durationDays: 10,
    travelPurpose: 'vacation',
    travelers: { adults: 2, children: 0, infants: 0, total: 2, type: 'couple' },
    budgetAmount: 3000,
    budgetCurrency: 'SAR',
    budgetPriority: 'balanced',
    preferredCabin: 'economy',
    directFlightPreferred: 'any',
    preferredDepartureTime: '',
    preferredArrivalTime: '',
    preferredAirlines: [],
    avoidAirlines: [],
    hotelStars: 4,
    hotelBudget: 800,
    preferredArea: '',
    familyFriendly: false,
    breakfastRequired: false,
    freeCancellation: false,
    hotelAmenities: [],
    activityStyle: '',
    shoppingInterest: 0,
    natureInterest: 0,
    cultureInterest: 0,
    beachInterest: 0,
    adventureInterest: 0,
    entertainmentInterest: 0,
    lowestPriceWeight: 0,
    comfortWeight: 0,
    timeWeight: 0,
    luxuryWeight: 0,
    familyWeight: 0,
    missingFields: [],
    highConfidence: [],
    mediumConfidence: [],
    lowConfidence: [],
    readyForSearch: true,
    completionPercentage: 100,
  }
}

describe('Sprint 11 sorting', () => {
  const score = (
    weightedAverage: number,
    recommendation: 'acceptable' | 'recommended' | 'excellent' = 'recommended',
  ) => ({
    weightedAverage,
    confidence: 0.8,
    categories: [],
    reasons: [],
    recommendation,
  })
  const set = [
    flight('a', { price: 2000, durationMinutes: 300, departureTime: '2026-11-10T14:00:00', decisionScore: score(50, 'acceptable') }),
    flight('b', { price: 900, durationMinutes: 400, departureTime: '2026-11-10T06:00:00', decisionScore: score(80) }),
    flight('c', { price: 1200, durationMinutes: 150, departureTime: '2026-11-10T20:00:00', decisionScore: score(95, 'excellent') }),
  ]

  it('sorts by best / cheapest / fastest / earliest / latest', () => {
    expect(sortFlights(set, 'best').map((f) => f.id)).toEqual(['c', 'b', 'a'])
    expect(sortFlights(set, 'cheapest').map((f) => f.id)).toEqual(['b', 'c', 'a'])
    expect(sortFlights(set, 'fastest').map((f) => f.id)).toEqual(['c', 'a', 'b'])
    expect(sortFlights(set, 'earliest_departure').map((f) => f.id)).toEqual(['b', 'a', 'c'])
    expect(sortFlights(set, 'latest_departure').map((f) => f.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('Sprint 11 filtering', () => {
  const set = [
    flight('nonstop', { stops: 0, price: 1000, airline: 'Saudia', cabin: 'economy', departureTime: '2026-11-10T08:00:00', arrivalTime: '2026-11-10T11:00:00' }),
    flight('one-stop', { stops: 1, price: 800, airline: 'Emirates', cabin: 'business', departureTime: '2026-11-10T15:00:00', arrivalTime: '2026-11-10T22:00:00' }),
    flight('two-stop', { stops: 2, price: 600, airline: 'Qatar Airways', cabin: 'economy', departureTime: '2026-11-10T19:00:00', arrivalTime: '2026-11-11T08:00:00' }),
  ]

  it('filters by max price, stops, airlines, cabin, and time windows', () => {
    expect(filterFlights(set, { ...emptyFlightFilters(), maxPrice: 900 }).map((f) => f.id))
      .toEqual(['one-stop', 'two-stop'])
    expect(filterFlights(set, { ...emptyFlightFilters(), stops: 'nonstop' }).map((f) => f.id))
      .toEqual(['nonstop'])
    expect(filterFlights(set, { ...emptyFlightFilters(), airlines: ['Emirates'] }).map((f) => f.id))
      .toEqual(['one-stop'])
    expect(filterFlights(set, { ...emptyFlightFilters(), cabin: 'business' }).map((f) => f.id))
      .toEqual(['one-stop'])
    expect(filterFlights(set, { ...emptyFlightFilters(), departureWindow: 'morning' }).map((f) => f.id))
      .toEqual(['nonstop'])
    expect(filterFlights(set, { ...emptyFlightFilters(), arrivalWindow: 'evening' }).map((f) => f.id))
      .toEqual(['one-stop'])
  })

  it('lists unique airlines', () => {
    expect(uniqueAirlines(set)).toEqual(['Emirates', 'Qatar Airways', 'Saudia'])
  })
})

describe('Sprint 11 view model & edge cases', () => {
  it('maps card fields and parses segment JSON', () => {
    const view = toFlightResultViewModel(flight('x'))
    expect(view.airlineCode).toBe('SV')
    expect(view.origin).toBe('RUH')
    expect(view.destination).toBe('DXB')
    expect(view.segments).toHaveLength(1)
    expect(view.segments[0].departureTerminal).toBe('1')
    expect(view.fareFamily).toBe('Saver')
    expect(formatFlightDuration(125)).toBe('2h 5m')
  })

  it('handles empty and large result sets', () => {
    expect(onlyFlights([])).toEqual([])
    const large = Array.from({ length: 200 }, (_, i) =>
      flight(`f-${i}`, { price: 500 + i, durationMinutes: 100 + (i % 50) }),
    )
    const sorted = sortFlights(large, 'cheapest')
    expect(sorted).toHaveLength(200)
    expect(sorted[0].price).toBeLessThanOrEqual(sorted[199].price)
    const filtered = filterFlights(large, { ...emptyFlightFilters(), maxPrice: 520 })
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((f) => f.price <= 520)).toBe(true)
  })

  it('extracts airline codes from names and flight numbers', () => {
    expect(extractAirlineCode('Qatar Airways', 'QR123')).toBe('QR')
    expect(extractAirlineCode('EK', '')).toBe('EK')
  })
})

describe('Sprint 11 AI recommendation', () => {
  it('builds concierge summary with count and recommendation (not hardcoded UI stub)', () => {
    const options = [
      flight('slow-cheap', {
        price: 700,
        durationMinutes: 500,
        airline: 'Budget Air',
        decisionScore: {
          weightedAverage: 40,
          confidence: 0.5,
          categories: [],
          reasons: [],
          recommendation: 'acceptable',
        },
      }),
      flight('fast', {
        price: 1100,
        durationMinutes: 160,
        airline: 'Qatar Airways',
        decisionScore: {
          weightedAverage: 92,
          confidence: 0.9,
          categories: [],
          reasons: [],
          recommendation: 'excellent',
        },
      }),
    ]
    const summary = buildFlightRecommendationSummary({
      options,
      searchRequest: searchRequest(),
      locale: 'en',
    })
    expect(summary.totalFlights).toBe(2)
    expect(summary.recommended?.id).toBe('fast')
    expect(summary.summaryText).toMatch(/2 flights|Qatar Airways/i)
    expect(summary.rationale).toMatch(/Qatar Airways/i)
  })

  it('handles empty results via consultant voice', () => {
    const summary = buildFlightRecommendationSummary({
      options: [],
      searchRequest: searchRequest(),
      locale: 'en',
    })
    expect(summary.totalFlights).toBe(0)
    expect(summary.recommended).toBeNull()
    expect(summary.summaryText.length).toBeGreaterThan(10)
  })
})

describe('Sprint 11 selection → booking session', () => {
  beforeEach(() => {
    resetBookingOrchestrator()
    clearLocalBookingSessions()
  })

  it('creates a booking session with itinerary, pricing, travellers, payload', async () => {
    const option = flight('sel-1', { price: 1500 })
    const result = await createSessionFromFlightSelection({
      option,
      searchRequest: searchRequest(),
      userId: 'user-1',
      travelSessionId: 'ts-1',
    })
    expect(result.session.items).toHaveLength(1)
    const item = result.session.items[0]
    expect(item.type).toBe('flight')
    expect(item.price).toBe(1500)
    expect(item.metadata.selectedItinerary).toMatchObject({
      origin: 'RUH',
      destination: 'DXB',
    })
    expect(item.metadata.pricing).toMatchObject({ amount: 1500, currency: 'SAR' })
    expect(item.metadata.travellersPlaceholder).toMatchObject({ adults: 2, total: 2 })
    expect(item.metadata.bookingPayload).toBeTruthy()
    expect(item.travelerSummary).toContain('adults:2')
  })
})

describe('Sprint 11 feature flag', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers ui.flight_results_experience enabled by default with concierge dependency', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.flight_results_experience')).toBe(true)
    registry.setEnabled('ai.concierge', false)
    expect(registry.isEnabled('ui.flight_results_experience')).toBe(false)
  })
})

describe('Sprint 11 provider-agnostic surface', () => {
  it('flightResults public API does not expose supplier clients', async () => {
    const mod = await import('../flightResults')
    const keys = Object.keys(mod).join(' ').toLowerCase()
    expect(keys).not.toMatch(/amadeus|duffel|travelport|sabre/)
    expect(typeof mod.sortFlights).toBe('function')
    expect(typeof mod.createSessionFromFlightSelection).toBe('function')
  })
})
