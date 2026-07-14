import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MockWeatherAdapter } from '../../adapters/MockWeatherAdapter'
import { RealWeatherAdapter } from '../../adapters/RealWeatherAdapter'
import { OpenWeatherApiClient } from '../../api/openWeatherApiClient'
import {
  normalizeOpenWeatherResponse,
  normalizeForecastItem,
  computeTravelScore,
  mapCondition,
} from '../weatherNormalization'
import { createWeatherService } from '../weatherService'
import { getProviderRegistry, resetProviderRegistry } from '../../registry/providerRegistry'
import { clearConfigCache } from '../../config/environment'
import type { OpenWeatherResponse, OpenWeatherForecastItem } from '../../api/openWeatherApiClient'
import type { ProviderRequest } from '../../../utils/contracts/providers/base'

const MOCK_REQUEST: ProviderRequest = {
  search: {
    destination: 'Tokyo',
    departureCity: 'Riyadh',
    departureDate: '2026-10-15',
    returnDate: '2026-10-25',
    durationDays: 10,
    travelPurpose: 'vacation',
    travelers: { adults: 2, children: 0, infants: 0, total: 2, type: 'couple' },
    budgetAmount: 20000,
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
  },
}

const SAMPLE_OPENWEATHER_ITEM: OpenWeatherForecastItem = {
  dt: 1729036800,
  main: { temp: 22.5, feels_like: 23, temp_min: 16, temp_max: 24, humidity: 60 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  clouds: { all: 0 },
  wind: { speed: 4.1, deg: 180 },
  visibility: 10000,
  pop: 0,
  dt_txt: '2026-10-15 12:00:00',
}

const SAMPLE_OPENWEATHER_RESPONSE: OpenWeatherResponse = {
  cod: '200',
  message: 0,
  cnt: 40,
  list: [
    SAMPLE_OPENWEATHER_ITEM,
    {
      ...SAMPLE_OPENWEATHER_ITEM,
      dt_txt: '2026-10-15 18:00:00',
      main: { ...SAMPLE_OPENWEATHER_ITEM.main, temp_max: 26, temp_min: 18 },
      weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
    },
    {
      ...SAMPLE_OPENWEATHER_ITEM,
      dt_txt: '2026-10-16 12:00:00',
      main: { ...SAMPLE_OPENWEATHER_ITEM.main, temp_max: 20, temp_min: 14, humidity: 70 },
      weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
    },
  ],
  city: {
    id: 1850147,
    name: 'Tokyo',
    coord: { lat: 35.68, lon: 139.69 },
    country: 'JP',
    population: 8336599,
    timezone: 32400,
  },
}

describe('MockWeatherAdapter', () => {
  it('returns successful ProviderResult with WeatherInfo', async () => {
    const adapter = new MockWeatherAdapter()
    const result = await adapter.getWeatherInfo(MOCK_REQUEST)
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.destination).toBe('Tokyo')
    expect(result.data!.forecasts.length).toBeGreaterThan(0)
    expect(result.source).toBe('mock')
  })

  it('has correct metadata', () => {
    const adapter = new MockWeatherAdapter()
    expect(adapter.metadata.type).toBe('weather')
    expect(adapter.metadata.id).toBe('mock-weather-001')
  })

  it('returns capabilities with realtime support', () => {
    const adapter = new MockWeatherAdapter()
    const caps = adapter.getCapabilities()
    expect(caps.supportsRealtime).toBe(true)
  })
})

describe('RealWeatherAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns successful result when API responds with valid data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => SAMPLE_OPENWEATHER_RESPONSE,
      text: async () => '',
    }))

    const adapter = new RealWeatherAdapter({
      apiKey: 'test-key', baseUrl: 'https://api.test.com/data/2.5',
      timeout: 5000, maxRetries: 2,
    })
    const result = await adapter.getWeatherInfo(MOCK_REQUEST)
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.destination).toBe('Tokyo')
    expect(result.data!.forecasts.length).toBeGreaterThan(0)
    expect(result.source).toBe('openweather')
    expect(result.providerId).toBe('openweather-001')
  })

  it('returns error result on 401 invalid key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({}), text: async () => 'Invalid API key',
    }))

    const adapter = new RealWeatherAdapter({
      apiKey: 'bad-key', baseUrl: 'https://api.test.com/data/2.5',
      timeout: 5000, maxRetries: 0,
    })
    const result = await adapter.getWeatherInfo(MOCK_REQUEST)
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.errors[0].code).toBe('INVALID_API_KEY')
    expect(result.errors[0].retryable).toBe(false)
  })

  it('returns error result on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const adapter = new RealWeatherAdapter({
      apiKey: 'test-key', baseUrl: 'https://api.test.com/data/2.5',
      timeout: 5000, maxRetries: 0,
    })
    const result = await adapter.getWeatherInfo(MOCK_REQUEST)
    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('NETWORK_FAILURE')
  })
})

describe('Weather Normalization', () => {
  it('maps condition codes correctly', () => {
    expect(mapCondition(800)).toBe('sunny')
    expect(mapCondition(801)).toBe('partly-cloudy')
    expect(mapCondition(804)).toBe('cloudy')
    expect(mapCondition(500)).toBe('rain')
    expect(mapCondition(200)).toBe('thunderstorm')
    expect(mapCondition(600)).toBe('snow')
    expect(mapCondition(741)).toBe('fog')
    expect(mapCondition(99999)).toBe('partly-cloudy')
  })

  it('normalizes a forecast item', () => {
    const item = normalizeForecastItem(SAMPLE_OPENWEATHER_ITEM)
    expect(item.date).toBe('2026-10-15')
    expect(item.tempHigh).toBe(24)
    expect(item.tempLow).toBe(16)
    expect(item.condition).toBe('sunny')
    expect(item.humidity).toBe(60)
    expect(item.windKph).toBe(Math.round(4.1 * 3.6))
  })

  it('normalizes a full OpenWeather response', () => {
    const info = normalizeOpenWeatherResponse(SAMPLE_OPENWEATHER_RESPONSE, 'openweather-001', 'Tokyo')
    expect(info.destination).toBe('Tokyo')
    expect(info.providerId).toBe('openweather-001')
    expect(info.forecasts.length).toBe(2)
    expect(info.forecasts[0].date).toBe('2026-10-15')
    expect(info.forecasts[1].date).toBe('2026-10-16')
    expect(info.currentSummary).toContain('طقس')
  })

  it('deduplicates forecast entries by date and aggregates min/max', () => {
    const info = normalizeOpenWeatherResponse(SAMPLE_OPENWEATHER_RESPONSE, 'test', 'Tokyo')
    const day1 = info.forecasts.find(f => f.date === '2026-10-15')
    expect(day1).toBeDefined()
    expect(day1!.tempHigh).toBe(26)
    expect(day1!.tempLow).toBe(16)
  })

  it('computes a travel score with all fields', () => {
    const info = normalizeOpenWeatherResponse(SAMPLE_OPENWEATHER_RESPONSE, 'test', 'Tokyo')
    const score = computeTravelScore(info, 10000)
    expect(score.temperature).toBeGreaterThan(0)
    expect(score.condition).toBeDefined()
    expect(score.humidity).toBeGreaterThan(0)
    expect(score.wind).toBeGreaterThan(0)
    expect(score.visibility).toBe(10)
    expect(score.travelScore).toBeGreaterThanOrEqual(0)
    expect(score.travelScore).toBeLessThanOrEqual(100)
    expect(score.summary).toBeDefined()
    expect(score.recommendation).toBeDefined()
  })

  it('travel score is high for sunny moderate weather', () => {
    const info = normalizeOpenWeatherResponse(SAMPLE_OPENWEATHER_RESPONSE, 'test', 'Tokyo')
    const score = computeTravelScore(info, 10000)
    expect(score.travelScore).toBeGreaterThanOrEqual(70)
  })

  it('travel score is low for thunderstorm weather', () => {
    const stormResponse: OpenWeatherResponse = {
      ...SAMPLE_OPENWEATHER_RESPONSE,
      list: [{
        ...SAMPLE_OPENWEATHER_ITEM,
        weather: [{ id: 200, main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' }],
      }],
    }
    const info = normalizeOpenWeatherResponse(stormResponse, 'test', 'Tokyo')
    const score = computeTravelScore(info, 1000)
    expect(score.travelScore).toBeLessThanOrEqual(60)
  })

  it('handles empty forecasts gracefully', () => {
    const emptyInfo = {
      id: 'empty', providerId: 'test', destination: 'Unknown',
      forecastPeriod: 'N/A', bestSeason: '', currentSummary: '', forecasts: [],
    }
    const score = computeTravelScore(emptyInfo, null)
    expect(score.travelScore).toBe(50)
    expect(score.temperature).toBe(20)
  })
})

describe('WeatherService', () => {
  beforeEach(() => { resetProviderRegistry(); clearConfigCache() })
  afterEach(() => {
    resetProviderRegistry(); clearConfigCache()
    vi.unstubAllGlobals(); vi.unstubAllEnvs()
  })

  it('returns a WeatherModel with mock source when registry uses mock', async () => {
    const service = createWeatherService()
    const model = await service.getWeather('Tokyo')
    expect(model.destination).toBe('Tokyo')
    expect(model.source).toBe('mock')
    expect(model.info).toBeDefined()
    expect(model.info!.forecasts.length).toBeGreaterThan(0)
    expect(model.travelScore).toBeDefined()
    expect(model.travelScore.travelScore).toBeGreaterThanOrEqual(0)
    expect(model.error).toBeNull()
  })

  it('falls back to mock when real adapter throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    vi.stubEnv('VITE_WEATHER_PROVIDER', 'openweather')
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'test-key')
    resetProviderRegistry(); clearConfigCache()

    const service = createWeatherService()
    const model = await service.getWeather('Tokyo')
    expect(model.source).toBe('fallback')
    expect(model.info).toBeDefined()
    expect(model.info!.forecasts.length).toBeGreaterThan(0)
    expect(model.error).not.toBeNull()
  })

  it('falls back to mock when real adapter returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({}), text: async () => 'Invalid key',
    }))
    vi.stubEnv('VITE_WEATHER_PROVIDER', 'openweather')
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'bad-key')
    resetProviderRegistry(); clearConfigCache()

    const service = createWeatherService()
    const model = await service.getWeather('Tokyo')
    expect(model.source).toBe('fallback')
    expect(model.info).toBeDefined()
    expect(model.error).not.toBeNull()
  })

  it('returns real data when API succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => SAMPLE_OPENWEATHER_RESPONSE,
      text: async () => '',
    }))
    vi.stubEnv('VITE_WEATHER_PROVIDER', 'openweather')
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'valid-key')
    resetProviderRegistry(); clearConfigCache()

    const service = createWeatherService()
    const model = await service.getWeather('Tokyo')
    expect(model.source).toBe('real')
    expect(model.info).toBeDefined()
    expect(model.info!.destination).toBe('Tokyo')
    expect(model.travelScore).toBeDefined()
    expect(model.error).toBeNull()
  })

  it('getWeatherForRequest uses request destination', async () => {
    const service = createWeatherService()
    const model = await service.getWeatherForRequest(MOCK_REQUEST)
    expect(model.destination).toBe('Tokyo')
  })
})

describe('Provider Registry — Weather', () => {
  beforeEach(() => { resetProviderRegistry(); clearConfigCache() })
  afterEach(() => {
    resetProviderRegistry(); clearConfigCache()
    vi.unstubAllGlobals(); vi.unstubAllEnvs()
  })

  it('returns MockWeatherAdapter by default', () => {
    const registry = getProviderRegistry()
    const weather = registry.getWeather()
    expect(weather).not.toBeNull()
    expect(weather!.metadata.id).toBe('mock-weather-001')
  })

  it('returns RealWeatherAdapter when openweather is configured', () => {
    vi.stubEnv('VITE_WEATHER_PROVIDER', 'openweather')
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'test-key')
    resetProviderRegistry(); clearConfigCache()
    const registry = getProviderRegistry()
    const weather = registry.getWeather()
    expect(weather).not.toBeNull()
    expect(weather!.metadata.id).toBe('openweather-001')
  })

  it('returns null for openweather when no API key', () => {
    vi.stubEnv('VITE_WEATHER_PROVIDER', 'openweather')
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', '')
    resetProviderRegistry(); clearConfigCache()
    const registry = getProviderRegistry()
    expect(registry.getWeather()).toBeNull()
  })

  it('can disable weather provider', () => {
    vi.stubEnv('VITE_WEATHER_ENABLED', 'false')
    resetProviderRegistry(); clearConfigCache()
    const registry = getProviderRegistry()
    expect(registry.getWeather()).toBeNull()
    expect(registry.isEnabled('weather')).toBe(false)
  })
})

describe('OpenWeatherApiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('retries on retryable error up to maxRetries', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      if (calls < 3) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => 'Server error' })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => SAMPLE_OPENWEATHER_RESPONSE, text: async () => '' })
    }))

    const client = new OpenWeatherApiClient({
      apiKey: 'test', baseUrl: 'https://api.test.com/data/2.5',
      timeout: 5000, maxRetries: 2,
    })
    const result = await client.getForecast('Tokyo')
    expect(result.data).not.toBeNull()
    expect(result.attempts).toBe(3)
    expect(calls).toBe(3)
  })

  it('does not retry on non-retryable error (401)', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}), text: async () => 'Invalid key' })
    }))

    const client = new OpenWeatherApiClient({
      apiKey: 'bad', baseUrl: 'https://api.test.com/data/2.5',
      timeout: 5000, maxRetries: 2,
    })
    const result = await client.getForecast('Tokyo')
    expect(result.data).toBeNull()
    expect(result.error!.code).toBe('INVALID_API_KEY')
    expect(calls).toBe(1)
  })

  it('maps timeout error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        const timer = setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100)
        opts?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }))

    const client = new OpenWeatherApiClient({
      apiKey: 'test', baseUrl: 'https://api.test.com/data/2.5',
      timeout: 10, maxRetries: 0,
    })
    const result = await client.getForecast('Tokyo')
    expect(result.data).toBeNull()
    expect(result.error!.category).toBe('timeout')
  })
})
