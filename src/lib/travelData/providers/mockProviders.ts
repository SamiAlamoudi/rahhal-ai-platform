/**
 * Sprint 57 — Mock providers only (no API keys, no network).
 */

import type {
  Activity,
  CurrencyQuote,
  Flight,
  Hotel,
  MapRoute,
  Restaurant,
  VisaInfo,
  Weather,
} from '../models'
import { mockProvenance } from '../provenance'
import type {
  ActivityProvider,
  ActivitySearchQuery,
  CurrencyProvider,
  CurrencyQuery,
  FlightProvider,
  FlightSearchQuery,
  HotelProvider,
  HotelSearchQuery,
  MapProvider,
  MapRouteQuery,
  RestaurantProvider,
  RestaurantSearchQuery,
  TravelProviderBundle,
  VisaProvider,
  VisaQuery,
  WeatherProvider,
  WeatherQuery,
} from './types'

const NOW = () => new Date().toISOString()

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createMockFlightProvider(id = 'mock_flights'): FlightProvider {
  return {
    id,
    async searchFlights(query: FlightSearchQuery): Promise<Flight[]> {
      const seed = hash(`${query.origin}|${query.destination}|${query.departDate}`)
      const currency = query.currency || 'SAR'
      const base = 900 + (seed % 700)
      const cabin = query.cabin || 'economy'
      return [0, 1, 2].map((i) => ({
        id: `${id}-${query.origin}-${query.destination}-${i}`,
        origin: query.origin.toUpperCase(),
        destination: query.destination.toUpperCase(),
        departAt: `${query.departDate}T0${8 + i}:15:00.000Z`,
        arriveAt: `${query.departDate}T1${2 + i}:40:00.000Z`,
        airline: i === 0 ? 'SV' : i === 1 ? 'EY' : 'QR',
        flightNumber: `${i === 0 ? 'SV' : i === 1 ? 'EY' : 'QR'}${100 + (seed % 800) + i}`,
        cabin,
        stops: i === 0 ? 0 : 1,
        durationMinutes: 320 + i * 55,
        price: {
          amount: base + i * 180,
          currency,
          unit: 'total',
        },
        provenance: mockProvenance(id, 0.78 - i * 0.05, true, NOW()),
      }))
    },
  }
}

export function createMockHotelProvider(id = 'mock_hotels'): HotelProvider {
  return {
    id,
    async searchHotels(query: HotelSearchQuery): Promise<Hotel[]> {
      const city = query.city.trim() || 'City'
      const currency = query.currency || 'SAR'
      const seed = hash(`${city}|${query.checkIn}|${query.checkOut}`)
      const nightly = 220 + (seed % 280)
      const names = [
        `${city} Marina Stay`,
        `${city} Garden Riads`,
        `${city} Central Suites`,
      ]
      return names.map((name, i) => ({
        id: `${id}-${city.toLowerCase().replace(/\s+/g, '-')}-${i}`,
        name,
        city,
        country: null,
        stars: (4 - (i % 2)) as number,
        neighbourhood: i === 0 ? 'Beachfront' : i === 1 ? 'Old Medina' : 'City Center',
        amenities: i === 0
          ? ['pool', 'spa', 'breakfast']
          : i === 1
            ? ['courtyard', 'breakfast']
            : ['wifi', 'gym'],
        price: {
          amount: nightly + i * 60,
          currency,
          unit: 'per_night',
        },
        rating: Number((4.6 - i * 0.25).toFixed(1)),
        provenance: mockProvenance(id, 0.74 - i * 0.04, true, NOW()),
      }))
    },
  }
}

export function createMockActivityProvider(id = 'mock_activities'): ActivityProvider {
  return {
    id,
    async searchActivities(query: ActivitySearchQuery): Promise<Activity[]> {
      const city = query.city.trim() || 'City'
      const currency = query.currency || 'SAR'
      const catalog: Array<Omit<Activity, 'provenance' | 'id'>> = [
        {
          title: `${city} walking tour`,
          city,
          category: query.category || 'culture',
          durationHours: 3,
          price: { amount: 120, currency, unit: 'per_person' },
        },
        {
          title: `${city} food tasting`,
          city,
          category: 'food',
          durationHours: 2.5,
          price: { amount: 180, currency, unit: 'per_person' },
        },
        {
          title: `${city} sunset experience`,
          city,
          category: 'leisure',
          durationHours: 2,
          price: { amount: 95, currency, unit: 'per_person' },
        },
      ]
      return catalog.map((row, i) => ({
        ...row,
        id: `${id}-${city.toLowerCase().replace(/\s+/g, '-')}-${i}`,
        provenance: mockProvenance(id, 0.7 - i * 0.03, true, NOW()),
      }))
    },
  }
}

export function createMockRestaurantProvider(id = 'mock_restaurants'): RestaurantProvider {
  return {
    id,
    async searchRestaurants(query: RestaurantSearchQuery): Promise<Restaurant[]> {
      const city = query.city.trim() || 'City'
      const cuisine = query.cuisine || 'local'
      return [
        {
          id: `${id}-${city}-1`,
          name: `${city} Harbor Table`,
          city,
          cuisine,
          priceLevel: 3,
          neighbourhood: 'Waterfront',
          rating: 4.7,
          provenance: mockProvenance(id, 0.68, true, NOW()),
        },
        {
          id: `${id}-${city}-2`,
          name: `${city} Souk Kitchen`,
          city,
          cuisine: cuisine === 'local' ? 'local' : cuisine,
          priceLevel: 2,
          neighbourhood: 'Old Town',
          rating: 4.5,
          provenance: mockProvenance(id, 0.66, true, NOW()),
        },
      ]
    },
  }
}

export function createMockWeatherProvider(id = 'mock_weather'): WeatherProvider {
  return {
    id,
    async getWeather(query: WeatherQuery): Promise<Weather[]> {
      const date = query.date || new Date().toISOString().slice(0, 10)
      const seed = hash(`${query.location}|${date}`)
      const max = 24 + (seed % 12)
      return [{
        location: query.location,
        date,
        summary: max > 30 ? 'Warm and clear' : 'Mild with light breeze',
        tempC: { min: max - 8, max },
        precipitationChance: seed % 40,
        provenance: mockProvenance(id, 0.8, true, NOW()),
      }]
    },
  }
}

export function createMockMapProvider(id = 'mock_maps'): MapProvider {
  return {
    id,
    async getRoute(query: MapRouteQuery): Promise<MapRoute[]> {
      const mode = query.mode || 'drive'
      const distanceKm = mode === 'walk' ? 1.8 : mode === 'transit' ? 6.4 : 9.2
      const durationMinutes = mode === 'walk' ? 28 : mode === 'transit' ? 22 : 18
      return [{
        id: `${id}-${query.from}-${query.to}-${mode}`,
        from: {
          id: `loc-${query.from}`,
          name: query.from,
          city: query.from,
          country: null,
          countryCode: null,
          latitude: null,
          longitude: null,
          timezone: null,
        },
        to: {
          id: `loc-${query.to}`,
          name: query.to,
          city: query.to,
          country: null,
          countryCode: null,
          latitude: null,
          longitude: null,
          timezone: null,
        },
        distanceKm,
        durationMinutes,
        mode,
        provenance: mockProvenance(id, 0.75, true, NOW()),
      }]
    },
  }
}

export function createMockCurrencyProvider(id = 'mock_currency'): CurrencyProvider {
  const TABLE: Record<string, number> = {
    'USD:SAR': 3.75,
    'EUR:SAR': 4.05,
    'SAR:USD': 0.2667,
    'USD:EUR': 0.92,
    'EUR:USD': 1.09,
  }
  return {
    id,
    async getRate(query: CurrencyQuery): Promise<CurrencyQuote> {
      const key = `${query.base.toUpperCase()}:${query.quote.toUpperCase()}`
      const reverse = `${query.quote.toUpperCase()}:${query.base.toUpperCase()}`
      const rate = TABLE[key]
        ?? (TABLE[reverse] ? 1 / TABLE[reverse]! : 1)
      return {
        base: query.base.toUpperCase(),
        quote: query.quote.toUpperCase(),
        rate,
        provenance: mockProvenance(id, 0.85, true, NOW()),
      }
    },
  }
}

export function createMockVisaProvider(id = 'mock_visa'): VisaProvider {
  return {
    id,
    async getVisaInfo(query: VisaQuery): Promise<VisaInfo> {
      const dest = query.destinationCountry.trim().toLowerCase()
      const free = /morocco|turkey|maldives|georgia/.test(dest)
      return {
        id: `${id}-${query.nationality}-${query.destinationCountry}`.toLowerCase(),
        nationality: query.nationality,
        destinationCountry: query.destinationCountry,
        requirement: free ? 'visa_free' : 'evisa',
        maxStayDays: free ? 90 : 30,
        notes: free
          ? 'Mock: typically visa-free for short tourism stays — verify before travel.'
          : 'Mock: eVisa or embassy process may apply — verify before travel.',
        provenance: mockProvenance(id, 0.6, true, NOW()),
      }
    },
  }
}

/** Full mock bundle — default foundation for Rahhal travel data. */
export function createMockTravelProviders(): TravelProviderBundle {
  return {
    flights: createMockFlightProvider(),
    hotels: createMockHotelProvider(),
    activities: createMockActivityProvider(),
    restaurants: createMockRestaurantProvider(),
    weather: createMockWeatherProvider(),
    maps: createMockMapProvider(),
    currency: createMockCurrencyProvider(),
    visa: createMockVisaProvider(),
  }
}
