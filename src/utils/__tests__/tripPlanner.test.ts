import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  planTrip,
  toTravelSearchRequest,
  type TripPlannerRequest,
  type TripPlannerDeps,
} from '../tripPlanner'
import type { FlightService } from '../../integrations/providers/flightService'
import type { HotelService } from '../../integrations/providers/hotelService'
import type { FlightOffer } from '../contracts/models/flight'
import type { HotelOffer } from '../contracts/models/hotel'
import { AmadeusFlightAdapter } from '../../integrations/providers/amadeus'
import { BookingComAdapter } from '../../integrations/providers/booking'

const BASE_REQ: TripPlannerRequest = {
  origin: 'الرياض',
  destination: 'طوكيو',
  departureDate: '2026-10-15',
  returnDate: '2026-10-25',
  travelers: { adults: 2, children: 1, infants: 0 },
  budget: { amount: 20000, currency: 'SAR' },
}

function sampleFlight(overrides: Partial<FlightOffer> = {}): FlightOffer {
  return {
    id: 'SV-100',
    providerId: 'amadeus-flight-001',
    title: 'SV 100: RUH → TYO',
    currency: 'SAR',
    price: 4200,
    originalPrice: 5000,
    rating: 4.2,
    familyFriendly: true,
    cancellationPolicy: 'free cancellation 24h',
    itinerary: {
      segments: [
        {
          origin: 'RUH',
          destination: 'NRT',
          departure: '2026-10-15T08:00',
          arrival: '2026-10-15T22:00',
          carrier: 'SV',
          flightNumber: 'SV100',
          aircraft: 'Boeing 777',
          cabin: 'economy',
          durationMinutes: 840,
        },
      ],
      totalDuration: 840,
      stops: 0,
      refundable: true,
      baggageIncluded: true,
    },
    ...overrides,
  }
}

function sampleHotel(overrides: Partial<HotelOffer> = {}): HotelOffer {
  return {
    id: 'HTL-1',
    providerId: 'booking-hotel-001',
    title: 'Tokyo Central Hotel',
    currency: 'SAR',
    price: 5500,
    originalPrice: null,
    rating: 4.5,
    hotelStars: 4,
    location: 'Shinjuku, Tokyo',
    area: 'Shinjuku',
    checkIn: '2026-10-15',
    checkOut: '2026-10-25',
    familyFriendly: true,
    breakfastIncluded: true,
    freeCancellation: true,
    amenities: ['wifi', 'pool'],
    roomTypes: [],
    ...overrides,
  }
}

function makeDeps(overrides: {
  flights?: FlightOffer[]
  hotels?: HotelOffer[]
  flightSource?: 'mock' | 'real' | 'fallback'
  hotelSource?: 'mock' | 'real' | 'fallback'
  flightError?: string | null
  hotelError?: string | null
  throwFlight?: boolean
  throwHotel?: boolean
  onFlight?: (req: unknown) => void
  onHotel?: (req: unknown) => void
} = {}): TripPlannerDeps {
  const flightService: FlightService = {
    async searchFlights(req) {
      overrides.onFlight?.(req)
      if (overrides.throwFlight) throw new Error('flight network down')
      return {
        source: overrides.flightSource ?? 'real',
        offers: overrides.flights ?? [sampleFlight()],
        latency: 12,
        error: overrides.flightError ?? null,
      }
    },
  }

  const hotelService: HotelService = {
    async searchHotels(req) {
      overrides.onHotel?.(req)
      if (overrides.throwHotel) throw new Error('hotel network down')
      return {
        source: overrides.hotelSource ?? 'real',
        offers: overrides.hotels ?? [sampleHotel()],
        latency: 18,
        error: overrides.hotelError ?? null,
      }
    },
  }

  return { flightService, hotelService }
}

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

describe('toTravelSearchRequest', () => {
  it('maps trip planner input onto TravelSearchRequest fields', () => {
    const search = toTravelSearchRequest(BASE_REQ)
    expect(search.departureCity).toBe('الرياض')
    expect(search.destination).toBe('طوكيو')
    expect(search.departureDate).toBe('2026-10-15')
    expect(search.returnDate).toBe('2026-10-25')
    expect(search.durationDays).toBe(10)
    expect(search.travelers).toEqual({
      adults: 2,
      children: 1,
      infants: 0,
      total: 3,
      type: 'family',
    })
    expect(search.budgetAmount).toBe(20000)
    expect(search.budgetCurrency).toBe('SAR')
    expect(search.readyForSearch).toBe(true)
  })
})

describe('planTrip — orchestration', () => {
  it('returns a unified itinerary with flights, hotels, summary, and estimated cost', async () => {
    const result = await planTrip(BASE_REQ, makeDeps())

    expect(result.summary).toMatchObject({
      origin: 'الرياض',
      destination: 'طوكيو',
      departureDate: '2026-10-15',
      returnDate: '2026-10-25',
      nights: 10,
      durationDays: 10,
      budgetAmount: 20000,
      currency: 'SAR',
    })
    expect(result.summary.travelers.total).toBe(3)
    expect(result.flights).toHaveLength(1)
    expect(result.hotels).toHaveLength(1)
    expect(result.selectedFlight?.id).toBe('SV-100')
    expect(result.selectedHotel?.id).toBe('HTL-1')
    expect(result.estimatedCost).toEqual({
      currency: 'SAR',
      flight: 4200,
      hotel: 5500,
      total: 9700,
      budgetAmount: 20000,
      remainingBudget: 10300,
      withinBudget: true,
    })
    expect(result.sources).toEqual({ flight: 'real', hotel: 'real' })
    expect(result.errors).toEqual([])
    expect(result.requestId).toBeTruthy()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('picks the cheapest flight and hotel for the package estimate', async () => {
    const result = await planTrip(BASE_REQ, makeDeps({
      flights: [
        sampleFlight({ id: 'expensive', price: 9000 }),
        sampleFlight({ id: 'cheap', price: 3100 }),
      ],
      hotels: [
        sampleHotel({ id: 'spa', price: 12000 }),
        sampleHotel({ id: 'value', price: 4000 }),
      ],
    }))

    expect(result.selectedFlight?.id).toBe('cheap')
    expect(result.selectedHotel?.id).toBe('value')
    expect(result.estimatedCost.total).toBe(7100)
    expect(result.estimatedCost.withinBudget).toBe(true)
  })

  it('flags packages that exceed the traveler budget', async () => {
    const result = await planTrip(
      { ...BASE_REQ, budget: { amount: 5000, currency: 'SAR' } },
      makeDeps({
        flights: [sampleFlight({ price: 4200 })],
        hotels: [sampleHotel({ price: 5500 })],
      }),
    )

    expect(result.estimatedCost.total).toBe(9700)
    expect(result.estimatedCost.withinBudget).toBe(false)
    expect(result.estimatedCost.remainingBudget).toBe(-4700)
  })

  it('searches flights and hotels concurrently with the same mapped request', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const seen: { flight?: unknown; hotel?: unknown } = {}
    const base = makeDeps()
    const depsConcurrent: TripPlannerDeps = {
      flightService: {
        async searchFlights(req) {
          seen.flight = req
          inFlight++
          maxInFlight = Math.max(maxInFlight, inFlight)
          await new Promise((r) => setTimeout(r, 40))
          inFlight--
          return base.flightService!.searchFlights(req)
        },
      },
      hotelService: {
        async searchHotels(req) {
          seen.hotel = req
          inFlight++
          maxInFlight = Math.max(maxInFlight, inFlight)
          await new Promise((r) => setTimeout(r, 40))
          inFlight--
          return base.hotelService!.searchHotels(req)
        },
      },
    }

    await planTrip(BASE_REQ, depsConcurrent)
    expect(maxInFlight).toBeGreaterThanOrEqual(2)
    expect((seen.flight as { search: { departureCity: string } }).search.departureCity).toBe('الرياض')
    expect((seen.hotel as { search: { destination: string } }).search.destination).toBe('طوكيو')
  })

  it('returns validation errors without calling providers', async () => {
    let flightCalls = 0
    const deps = makeDeps({
      onFlight: () => { flightCalls++ },
      onHotel: () => { flightCalls++ },
    })

    const result = await planTrip({
      ...BASE_REQ,
      origin: '',
      destination: '',
    }, deps)

    expect(result.flights).toEqual([])
    expect(result.hotels).toEqual([])
    expect(result.sources).toEqual({ flight: 'skipped', hotel: 'skipped' })
    expect(result.errors.some((e) => e.domain === 'validation')).toBe(true)
    expect(flightCalls).toBe(0)
  })

  it('keeps hotel results when flight search throws', async () => {
    const result = await planTrip(BASE_REQ, makeDeps({ throwFlight: true }))
    expect(result.hotels).toHaveLength(1)
    expect(result.flights).toEqual([])
    expect(result.errors.some((e) => e.domain === 'flight')).toBe(true)
    expect(result.estimatedCost.hotel).toBe(5500)
    expect(result.estimatedCost.flight).toBeNull()
    expect(result.estimatedCost.total).toBe(5500)
  })

  it('keeps flight results when hotel search throws', async () => {
    const result = await planTrip(BASE_REQ, makeDeps({ throwHotel: true }))
    expect(result.flights).toHaveLength(1)
    expect(result.hotels).toEqual([])
    expect(result.errors.some((e) => e.domain === 'hotel')).toBe(true)
    expect(result.estimatedCost.flight).toBe(4200)
    expect(result.estimatedCost.total).toBe(4200)
  })
})

describe('planTrip — provider adapter integration (Amadeus + Booking)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('composes live Amadeus + Booking adapters behind FlightService/HotelService shapes', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url)
      if (u.includes('amadeus-token')) {
        return Promise.resolve(mockResponse({
          access_token: 'tok',
          token_type: 'Bearer',
          expires_in: 1800,
        }))
      }
      if (u.includes('/v1/shopping/flight-offers')) {
        return Promise.resolve(mockResponse({
          meta: { count: 1 },
          data: [{
            type: 'flight-offer',
            id: '1',
            source: 'GDS',
            instantTicketingRequired: false,
            nonHomogeneous: false,
            oneWay: true,
            lastTicketingDate: '2026-10-14',
            numberOfBookableSeats: 2,
            itineraries: [{
              duration: 'PT10H',
              segments: [{
                departure: { iataCode: 'RUH', at: '2026-10-15T01:00:00' },
                arrival: { iataCode: 'NRT', at: '2026-10-15T17:00:00' },
                carrierCode: 'SV',
                number: '100',
                duration: 'PT10H',
                id: '1',
                numberOfStops: 0,
              }],
            }],
            price: { currency: 'SAR', total: '4100.00', base: '3800.00' },
            validatingAirlineCodes: ['SV'],
          }],
          dictionaries: { carriers: { SV: 'Saudia' } },
        }))
      }
      if (u.includes('/hotels/searchDestination')) {
        return Promise.resolve(mockResponse({
          status: true,
          data: [{
            dest_id: '-246227',
            search_type: 'city',
            dest_type: 'city',
            label: 'Tokyo, Japan',
            city_name: 'Tokyo',
          }],
        }))
      }
      if (u.includes('/hotels/search')) {
        return Promise.resolve(mockResponse({
          result: [{
            hotel_id: 42,
            hotel_name: 'Park Hyatt Tokyo',
            currency_code: 'SAR',
            product_price: '6200',
            review_score: 9.1,
            hotel_class: 5,
            city: 'Tokyo',
            address: 'Shinjuku',
            mealplan_included: true,
            cancellation: 'Free cancellation',
            photos: [],
            facilities: [],
            room_data: [],
          }],
        }))
      }
      // Locations should not be needed for Arabic aliases RUH/TYO
      if (u.includes('reference-data/locations')) {
        return Promise.resolve(mockResponse({ data: [] }))
      }
      return Promise.resolve(mockResponse({}, 404))
    })
    vi.stubGlobal('fetch', fetchMock)

    const amadeus = new AmadeusFlightAdapter({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 0,
    })

    const booking = new BookingComAdapter({
      apiKey: 'test-rapid-key',
      baseUrl: 'https://booking-com15.p.rapidapi.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })

    const flightService: FlightService = {
      async searchFlights(req) {
        const result = await amadeus.searchFlights(req)
        if (!result.success || !result.data) {
          return {
            source: 'fallback',
            offers: [],
            latency: result.latency,
            error: result.errors[0]?.message ?? 'Amadeus failed',
          }
        }
        return { source: 'real', offers: result.data, latency: result.latency, error: null }
      },
    }

    const hotelService: HotelService = {
      async searchHotels(req) {
        const result = await booking.searchHotels(req)
        if (!result.success || !result.data) {
          return {
            source: 'fallback',
            offers: [],
            latency: result.latency,
            error: result.errors[0]?.message ?? 'Booking failed',
          }
        }
        return { source: 'real', offers: result.data, latency: result.latency, error: null }
      },
    }

    const result = await planTrip(BASE_REQ, { flightService, hotelService })

    expect(result.sources).toEqual({ flight: 'real', hotel: 'real' })
    expect(result.flights.length).toBeGreaterThan(0)
    expect(result.hotels.length).toBeGreaterThan(0)
    expect(result.flights[0].providerId).toBe('amadeus-flight-001')
    expect(result.hotels[0].providerId).toBe('booking-hotel-001')
    expect(result.estimatedCost.flight).toBeGreaterThan(0)
    expect(result.estimatedCost.hotel).toBeGreaterThan(0)
    expect(result.estimatedCost.total).toBe(
      (result.estimatedCost.flight ?? 0) + (result.estimatedCost.hotel ?? 0),
    )
    expect(result.summary.nights).toBe(10)
    expect(result.errors).toEqual([])

    const flightUrl = fetchMock.mock.calls
      .map(([u]) => String(u))
      .find((u) => u.includes('/v1/shopping/flight-offers'))
    expect(flightUrl).toBeTruthy()
    expect(flightUrl!).toContain('originLocationCode=RUH')
    expect(flightUrl!).toContain('destinationLocationCode=TYO')

    const destUrl = fetchMock.mock.calls
      .map(([u]) => String(u))
      .find((u) => u.includes('/hotels/searchDestination'))
    expect(destUrl).toBeTruthy()
    expect(destUrl!).toContain('query=Tokyo')

    const hotelUrl = fetchMock.mock.calls
      .map(([u]) => String(u))
      .find((u) => u.includes('/hotels/search?') || u.includes('/hotels/search&'))
    expect(hotelUrl).toBeTruthy()
    expect(hotelUrl!).toContain('dest_id=-246227')
  })
})
