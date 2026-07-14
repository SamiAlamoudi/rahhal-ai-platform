import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orchestrateLiveSearch, type LiveSearchDeps } from '../liveSearchOrchestrator'
import { buildTravelSearchRequest } from '../travelSearchRequest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
} from '../travelSession'
import type { FlightService } from '../../integrations/providers/flightService'
import type { HotelService } from '../../integrations/providers/hotelService'
import type { RentalCarService } from '../../integrations/providers/rentalCarService'
import type { WeatherService } from '../../integrations/weather/weatherService'
import type { FlightOffer } from '../contracts/models/flight'
import type { HotelOffer } from '../contracts/models/hotel'
import type { Vehicle } from '../contracts/models/rentalCar'
import type { ActivityOffer } from '../contracts/models/activity'
import type { WeatherInfo } from '../contracts/models/weather'
import type { ProviderRequest } from '../contracts/providers/base'
import type { ProviderResult } from '../contracts/result'
import { okResult } from '../contracts/result'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function makeRequest() {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  s = confirmDecisionProfile(s)
  return buildTravelSearchRequest(s)
}

function sampleFlight(): FlightOffer {
  return {
    id: 'SV-100',
    providerId: 'amadeus-flight',
    title: 'SV 100: الرياض → طوكيو',
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
  }
}

function sampleHotel(): HotelOffer {
  return {
    id: 'HTL-1',
    providerId: 'booking-com',
    title: 'Tokyo Central Hotel',
    currency: 'SAR',
    price: 800,
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
  }
}

function sampleVehicle(): Vehicle {
  return {
    provider: 'rentalcars',
    providerId: 'rentalcars-com',
    company: 'Hertz',
    vehicleName: 'Toyota Corolla',
    category: 'compact',
    transmission: 'automatic',
    fuelType: 'petrol',
    seats: 5,
    doors: 4,
    airConditioning: true,
    luggageLarge: 1,
    luggageSmall: 2,
    price: 250,
    currency: 'SAR',
    pickupLocation: 'Tokyo Airport',
    dropoffLocation: 'Tokyo Airport',
    pickupDate: '2026-10-15',
    dropoffDate: '2026-10-25',
    unlimitedMileage: true,
    insuranceIncluded: true,
    rating: 4.3,
    image: '',
    bookingUrl: 'https://example.com/book',
  }
}

function sampleActivity(): ActivityOffer {
  return {
    id: 'ACT-1',
    providerId: 'mock-activity-001',
    title: 'Tokyo City Walk',
    currency: 'SAR',
    price: 200,
    originalPrice: null,
    rating: 4.8,
    location: 'Shibuya',
    durationMinutes: 180,
    activityType: 'culture',
    familyFriendly: true,
    cancellationPolicy: 'free cancellation 24h',
    destination: 'Tokyo',
  }
}

function sampleWeather(): WeatherInfo {
  return {
    id: 'wx-1',
    providerId: 'openweather',
    destination: 'Tokyo',
    forecastPeriod: '7 days',
    bestSeason: 'autumn',
    currentSummary: 'Mild and clear',
    forecasts: [],
  }
}

function makeDeps(overrides: Partial<{
  flightSource: 'mock' | 'real' | 'fallback'
  hotelSource: 'mock' | 'real' | 'fallback'
  rentalSource: 'mock' | 'real' | 'fallback'
  weatherSource: 'mock' | 'real' | 'fallback'
  flightError: string | null
  failFlight: boolean
}> = {}): LiveSearchDeps {
  const flightService: FlightService = {
    async searchFlights() {
      if (overrides.failFlight) throw new Error('network down')
      return {
        source: overrides.flightSource ?? 'real',
        offers: [sampleFlight()],
        latency: 10,
        error: overrides.flightError ?? null,
      }
    },
  }

  const hotelService: HotelService = {
    async searchHotels() {
      return {
        source: overrides.hotelSource ?? 'real',
        offers: [sampleHotel()],
        latency: 10,
        error: null,
      }
    },
  }

  const rentalCarService: RentalCarService = {
    async searchRentalCars() {
      return {
        source: overrides.rentalSource ?? 'real',
        vehicles: [sampleVehicle()],
        latency: 10,
        error: null,
      }
    },
  }

  const weatherModel = {
    destination: 'Tokyo',
    source: overrides.weatherSource ?? ('real' as const),
    info: sampleWeather(),
    travelScore: {
      temperature: 22,
      condition: 'partly-cloudy' as const,
      humidity: 60,
      wind: 15,
      visibility: 10,
      travelScore: 75,
      summary: 'جيد',
      recommendation: 'مناسب للسفر',
    },
    latency: 5,
    error: null,
  }

  const weatherService: WeatherService = {
    async getWeather() {
      return weatherModel
    },
    async getWeatherForRequest() {
      return weatherModel
    },
  }

  const searchActivities = async (
    _req: ProviderRequest,
  ): Promise<ProviderResult<ActivityOffer[]>> => {
    return okResult('mock-activity-001', 'Mock Activity Provider', [sampleActivity()], 5, 'mock')
  }

  return { flightService, hotelService, rentalCarService, weatherService, searchActivities }
}

describe('orchestrateLiveSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ranked options from flight, hotel, and rental adapters', async () => {
    const req = makeRequest()
    const result = await orchestrateLiveSearch(req, makeDeps())

    expect(result.rankedOptions.length).toBeGreaterThan(0)
    const types = new Set(result.rankedOptions.map((o) => o.type))
    expect(types.has('flight')).toBe(true)
    expect(types.has('hotel')).toBe(true)
    // 10-day trip ⇒ transportation (rental) is required by the search plan
    expect(types.has('transportation')).toBe(true)

    for (const opt of result.rankedOptions) {
      expect(opt.decisionScore).not.toBeNull()
      expect(opt.recommendationLevel).not.toBeNull()
    }

    expect(result.sources.flight).toBe('real')
    expect(result.sources.hotel).toBe('real')
    expect(result.sources.rentalCar).toBe('real')
    expect(result.sources.weather).toBe('real')
    expect(result.weather?.info?.destination).toBe('Tokyo')
  })

  it('includes activity offers when interests make activity required', async () => {
    const base = makeRequest()
    const req = {
      ...base,
      cultureInterest: 3 as const,
      shoppingInterest: 2 as const,
      natureInterest: 1 as const,
    }
    const deps = makeDeps()
    const result = await orchestrateLiveSearch(req, deps)

    expect(result.sources.activity).not.toBe('skipped')
    expect(result.rankedOptions.some((o) => o.type === 'activity')).toBe(true)
    expect(result.sources.activity).toBe('mock')
  })

  it('keeps mock fallback results when a provider reports fallback + error', async () => {
    const req = makeRequest()
    const result = await orchestrateLiveSearch(
      req,
      makeDeps({ flightSource: 'fallback', flightError: 'Amadeus unavailable' }),
    )

    expect(result.sources.flight).toBe('fallback')
    expect(result.errors.some((e) => e.error.includes('Amadeus unavailable'))).toBe(true)
    expect(result.rankedOptions.some((o) => o.type === 'flight')).toBe(true)
  })

  it('ranks options by decision score descending', async () => {
    const req = makeRequest()
    const result = await orchestrateLiveSearch(req, makeDeps())
    const scores = result.rankedOptions.map((o) => o.decisionScore?.weightedAverage ?? 0)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('survives thrown flight errors without aborting the whole search', async () => {
    const req = makeRequest()
    const result = await orchestrateLiveSearch(req, makeDeps({ failFlight: true }))

    expect(result.sources.flight).toBe('fallback')
    expect(result.errors.some((e) => e.error.includes('network down'))).toBe(true)
    expect(result.rankedOptions.some((o) => o.type === 'hotel')).toBe(true)
  })

  it('works with default (registry) services when deps omitted — stays runnable on mocks', async () => {
    const req = makeRequest()
    const result = await orchestrateLiveSearch(req)

    expect(result.rankedOptions.length).toBeGreaterThan(0)
    expect(result.providersQueried).toBeGreaterThan(0)
    // Default env uses mock adapters via the provider registry
    expect(['mock', 'fallback', 'real']).toContain(result.sources.flight)
    expect(result.weather).not.toBeNull()
  })
})
