import type { WeatherInfo } from '../../utils/contracts/models/weather'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { ProviderResult } from '../../utils/contracts/result'
import { getProviderRegistry } from '../registry'
import { MockWeatherAdapter } from '../adapters/MockWeatherAdapter'
import { computeTravelScore, type WeatherTravelScore } from './weatherNormalization'

export interface WeatherModel {
  destination: string
  source: 'mock' | 'real' | 'fallback'
  info: WeatherInfo | null
  travelScore: WeatherTravelScore
  latency: number
  error: string | null
}

export interface WeatherService {
  getWeather(destination: string): Promise<WeatherModel>
  getWeatherForRequest(req: ProviderRequest): Promise<WeatherModel>
}

function buildModel(
  destination: string,
  source: WeatherModel['source'],
  result: ProviderResult<WeatherInfo>,
  fallbackError: string | null,
): WeatherModel {
  if (!result.success || !result.data) {
    return {
      destination,
      source,
      info: result.data,
      travelScore: {
        temperature: 20,
        condition: 'partly-cloudy',
        humidity: 60,
        wind: 15,
        visibility: 10,
        travelScore: 50,
        summary: 'لا تتوفر بيانات كافية',
        recommendation: 'يُنصح بالتحقق من الطقس قبل السفر',
      },
      latency: result.latency,
      error: fallbackError || (result.errors[0]?.message ?? 'Unknown error'),
    }
  }

  const fallbackErr = fallbackError;
  const visibilityMeters = source === 'real' ? 10000 : null
  const travelScore = computeTravelScore(result.data, visibilityMeters)
  return {
    destination,
    source,
    info: result.data,
    travelScore,
    latency: result.latency,
    error: fallbackErr,
  }
}

export function createWeatherService(): WeatherService {
  async function fetchWithFallback(destination: string, req: ProviderRequest): Promise<WeatherModel> {
    const registry = getProviderRegistry()
    const provider = registry.getWeather()

    if (provider) {
      try {
        const result = await provider.getWeatherInfo(req)
        if (result.success && result.data) {
          const source: WeatherModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
          return buildModel(destination, source, result, null)
        }
        const mock = new MockWeatherAdapter()
        const fallbackResult = await mock.getWeatherInfo(req)
        return buildModel(destination, 'fallback', fallbackResult, result.errors[0]?.message ?? 'Provider returned no data')
      } catch {
        const mock = new MockWeatherAdapter()
        const fallbackResult = await mock.getWeatherInfo(req)
        return buildModel(destination, 'fallback', fallbackResult, 'Provider threw an exception')
      }
    }

    const mock = new MockWeatherAdapter()
    const fallbackResult = await mock.getWeatherInfo(req)
    return buildModel(destination, 'fallback', fallbackResult, 'No weather provider registered')
  }

  return {
    async getWeather(destination: string): Promise<WeatherModel> {
      const req: ProviderRequest = {
        search: {
          destination,
          departureCity: '',
          departureDate: '',
          returnDate: '',
          durationDays: 0,
          travelPurpose: '',
          travelers: { adults: 1, children: 0, infants: 0, total: 1, type: '' },
          budgetAmount: 0,
          budgetCurrency: 'SAR',
          budgetPriority: '',
          preferredCabin: '',
          directFlightPreferred: '',
          preferredDepartureTime: '',
          preferredArrivalTime: '',
          preferredAirlines: [],
          avoidAirlines: [],
          hotelStars: 0,
          hotelBudget: 0,
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
          readyForSearch: false,
          completionPercentage: 0,
        },
      }
      return fetchWithFallback(destination, req)
    },

    async getWeatherForRequest(req: ProviderRequest): Promise<WeatherModel> {
      const destination = req.search.destination || 'Unknown'
      return fetchWithFallback(destination, req)
    },
  }
}

let cachedService: WeatherService | null = null

export function getWeatherService(): WeatherService {
  if (cachedService) return cachedService
  cachedService = createWeatherService()
  return cachedService
}

export function resetWeatherService(): void {
  cachedService = null
}
