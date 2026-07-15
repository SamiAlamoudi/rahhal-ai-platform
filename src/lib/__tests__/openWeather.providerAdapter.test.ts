import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createOpenWeatherProviderAdapter,
  createWeatherProviderAdapter,
  createAggregationEngine,
  createProviderRegistry,
  createMockOpenWeatherAdapter,
  resolveOpenWeatherProviderConfig,
  isOpenWeatherConfigured,
  weatherSnapshotToNormalizedOffer,
  createDefaultProviderAdapters,
} from '../agent/aggregation'
import type { CanonicalWeatherSnapshot } from '../../integrations/providers/openWeather/types'
import { OpenWeatherApiClient } from '../../integrations/providers/openWeather/openWeatherApiClient'
import { buildTripPlan } from '../agent/buildItinerary'
import { mergeToolResultsIntoPlan } from '../agent/tools/mergeToolResults'
import { emptyRequirements } from '../agent/types'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
import type { ChatMessage } from '../chat/chatTypes'
import type { AgentToolResult } from '../agent/tools/types'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

function forecastResponse() {
  return {
    cod: '200',
    city: {
      id: 1850147,
      name: 'Tokyo',
      coord: { lat: 35.6895, lon: 139.6917 },
      country: 'JP',
      timezone: 32400,
    },
    list: [
      {
        dt: 1_714_046_400,
        main: { temp: 18, feels_like: 17, temp_min: 16, temp_max: 20, humidity: 70 },
        weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
        wind: { speed: 3.2, deg: 90 },
        visibility: 8000,
        pop: 0.6,
        dt_txt: '2027-04-02 09:00:00',
      },
      {
        dt: 1_714_057_200,
        main: { temp: 21, feels_like: 20, temp_min: 18, temp_max: 23, humidity: 65 },
        weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
        wind: { speed: 2.5, deg: 100 },
        visibility: 9000,
        pop: 0.55,
        dt_txt: '2027-04-02 12:00:00',
      },
      {
        dt: 1_714_132_800,
        main: { temp: 22, feels_like: 21, temp_min: 19, temp_max: 24, humidity: 60 },
        weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
        wind: { speed: 2.1, deg: 80 },
        visibility: 10000,
        pop: 0.1,
        dt_txt: '2027-04-03 09:00:00',
      },
    ],
  }
}

function currentResponse() {
  return {
    name: 'Tokyo',
    coord: { lat: 35.6895, lon: 139.6917 },
    dt: 1_714_046_400,
    main: { temp: 19, feels_like: 18, humidity: 68 },
    weather: [{ id: 500, main: 'Rain', description: 'light rain', icon: '10d' }],
    wind: { speed: 3, deg: 90 },
    visibility: 8500,
    sys: { sunrise: 1_714_040_000, sunset: 1_714_088_000 },
  }
}

describe('Phase Q OpenWeather WeatherProviderAdapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('is unavailable without API key or proxy', () => {
    const config = resolveOpenWeatherProviderConfig({
      enabled: true,
      apiKey: null,
      proxyUrl: null,
      invokeApiKey: null,
    })
    expect(isOpenWeatherConfigured(config)).toBe(false)
    const adapter = createOpenWeatherProviderAdapter({ config })
    expect(adapter.isAvailable()).toBe(false)
    expect(adapter.metadata.id).toBe('openweather')
    expect(adapter.metadata.mocked).toBe(false)
  })

  it('exposes WeatherProviderAdapter alias with live credentials', () => {
    const adapter = createWeatherProviderAdapter({
      config: { enabled: true, apiKey: 'test-ow-key' },
    })
    expect(adapter.isAvailable()).toBe(true)
    expect(adapter.getCapabilities().features).toEqual(expect.arrayContaining([
      'current_weather',
      'hourly_forecast',
      'daily_forecast',
      'uv_index',
      'rain_probability',
      'weather_alerts',
      'sunrise_sunset',
    ]))
  })

  it('never reads OpenWeather API keys from VITE_* env vars', () => {
    vi.stubEnv('VITE_OPENWEATHER_API_KEY', 'leaked-key')
    const config = resolveOpenWeatherProviderConfig({
      enabled: true,
      apiKey: null,
      proxyUrl: null,
      invokeApiKey: null,
    })
    expect(config.apiKey).toBeNull()
    expect(isOpenWeatherConfigured(config)).toBe(false)
  })

  it('normalizes canonical snapshot into agent payload (no OpenWeather types)', () => {
    const snapshot: CanonicalWeatherSnapshot = {
      destination: 'Tokyo',
      summary: 'Rain with rain chances in Tokyo; daytime ~20°C',
      averageHighC: 20,
      averageLowC: 16,
      season: 'spring',
      current: {
        destination: 'Tokyo',
        observedAt: '2027-04-02T00:00:00.000Z',
        tempC: 19,
        feelsLikeC: 18,
        humidity: 68,
        windKph: 11,
        visibilityKm: 9,
        uvIndex: 4,
        condition: 'rain',
        description: 'light rain',
        sunrise: '2027-04-02T05:00:00.000Z',
        sunset: '2027-04-02T18:00:00.000Z',
        rainProbability: 0.6,
      },
      hourly: [],
      daily: [{
        date: '2027-04-02',
        tempHighC: 20,
        tempLowC: 16,
        feelsLikeC: 17,
        humidity: 70,
        windKph: 12,
        visibilityKm: null,
        uvIndex: null,
        rainProbability: 0.6,
        condition: 'rain',
        description: 'light rain',
        sunrise: null,
        sunset: null,
      }],
      alerts: [],
      packingHints: ['Pack a compact umbrella or light rain jacket'],
      travelTips: ['On 2027-04-02, favor indoor museums/cafés during peak rain (60% chance)'],
    }
    const normalized = weatherSnapshotToNormalizedOffer(snapshot, 'openweather')
    expect(normalized.domain).toBe('weather')
    expect(normalized.payload).toMatchObject({
      summary: expect.stringContaining('Tokyo'),
      averageHighC: 20,
      packingHints: expect.arrayContaining([expect.stringMatching(/umbrella/i)]),
      source: 'openweather',
    })
    expect(JSON.stringify(normalized)).not.toMatch(/temp_max|dt_txt|weather\[0\]/)
  })

  it('fetches current + forecast via client and returns canonical weather', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/weather?')) {
        return new Response(JSON.stringify(currentResponse()), { status: 200 })
      }
      if (url.includes('/onecall')) {
        return new Response(JSON.stringify({ status: 401 }), { status: 401 })
      }
      if (url.includes('/uvi')) {
        return new Response(JSON.stringify({ value: 5.2 }), { status: 200 })
      }
      return new Response(JSON.stringify(forecastResponse()), { status: 200 })
    })

    const client = new OpenWeatherApiClient({
      apiKey: 'test-key',
      proxyUrl: null,
      invokeApiKey: null,
      baseUrl: 'https://api.openweathermap.org/data/2.5',
      timeoutMs: 5_000,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const adapter = createOpenWeatherProviderAdapter({
      config: { enabled: true, apiKey: 'test-key' },
      deps: { client },
    })

    const result = await adapter.fetch({
      domain: 'weather',
      locale: 'en',
      input: { destination: 'Tokyo', startDate: '2027-04-02' },
    })

    expect(result.status).toBe('ok')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.payload.summary).toEqual(expect.any(String))
    expect(result.items[0]?.payload.current).toMatchObject({
      tempC: expect.any(Number),
      feelsLikeC: expect.any(Number),
      humidity: expect.any(Number),
      windKph: expect.any(Number),
    })
    expect(Array.isArray(result.items[0]?.payload.hourly)).toBe(true)
    expect(Array.isArray(result.items[0]?.payload.daily)).toBe(true)
    expect(JSON.stringify(result.items)).not.toMatch(/dt_txt|temp_max/)

    const current = await adapter.getCurrentWeather('Tokyo')
    expect(current?.condition).toBe('rain')
    const daily = await adapter.getDailyForecast('Tokyo')
    expect(daily.length).toBeGreaterThan(0)
  })

  it('falls back from OpenWeather to mock weather when OpenWeather fails', async () => {
    const live = createOpenWeatherProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'openweather',
            status: 'error',
            items: [],
            error: 'upstream_down',
            errorCode: 'upstream_error',
            durationMs: 5,
          }
        },
      },
    })
    const registry = createProviderRegistry([
      live,
      createMockOpenWeatherAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })

    const result = await engine.aggregate({
      domain: 'weather',
      locale: 'en',
      input: { destination: 'Japan', startDate: '2027-04-01' },
      selectionStrategy: 'priority_fallback',
    })

    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults.some((p) => p.providerId === 'openweather' && p.status === 'error')).toBe(true)
    expect(result.items[0]?.payload).toMatchObject({
      summary: expect.any(String),
      averageHighC: expect.any(Number),
    })
  })

  it('uses OpenWeather results when the real adapter succeeds', async () => {
    const live = createOpenWeatherProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'openweather',
            status: 'ok',
            items: [weatherSnapshotToNormalizedOffer({
              destination: 'Tokyo',
              summary: 'Live OpenWeather outlook',
              averageHighC: 17,
              averageLowC: 12,
              season: 'spring',
              current: null,
              hourly: [],
              daily: [],
              alerts: [],
              packingHints: ['Light layer'],
              travelTips: [],
            }, 'openweather')],
            durationMs: 12,
          }
        },
      },
    })
    const registry = createProviderRegistry([
      live,
      createMockOpenWeatherAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
    })
    const result = await engine.aggregate({
      domain: 'weather',
      locale: 'en',
      input: { destination: 'Japan' },
    })
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.items[0]?.payload.summary).toBe('Live OpenWeather outlook')
    expect(result.items[0]?.providerId).toBe('openweather')
  })

  it('handles rate-limit responses from OpenWeather', async () => {
    const adapter = createOpenWeatherProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'openweather',
            status: 'rate_limited',
            items: [],
            error: 'rate_limited',
            errorCode: 'rate_limited',
            retryAfterMs: 1000,
            durationMs: 3,
          }
        },
      },
    })
    const result = await adapter.fetch({
      domain: 'weather',
      locale: 'en',
      input: { destination: 'Japan' },
    })
    expect(result.status).toBe('rate_limited')
    expect(result.errorCode).toBe('rate_limited')
  })

  it('registers openweather ahead of openweather_mock in the default set', () => {
    const adapters = createDefaultProviderAdapters()
    const weather = adapters.filter((a) => a.supports('weather') && !a.metadata.futureSlot)
    const ids = weather.map((a) => a.metadata.id)
    expect(ids).toEqual(expect.arrayContaining(['openweather', 'openweather_mock']))
    const live = weather.find((a) => a.metadata.id === 'openweather')
    const mock = weather.find((a) => a.metadata.id === 'openweather_mock')
    expect(live?.metadata.priority ?? 0).toBeGreaterThan(mock?.metadata.priority ?? 0)
  })

  it('enriches TripPlan days with weather advice, packing, and tips', () => {
    const base = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 2,
        travelers: 2,
        startDate: '2027-04-02',
      },
    })
    const results: AgentToolResult[] = [{
      tool: 'weather',
      status: 'ok',
      summary: 'weather',
      data: {
        summary: 'Rainy spell in Tokyo; daytime ~20°C',
        averageHighC: 20,
        season: 'spring',
        packingHints: ['Pack a compact umbrella or light rain jacket'],
        travelTips: ['On 2027-04-02, favor indoor museums/cafés during peak rain (60% chance)'],
        daily: [
          {
            date: '2027-04-02',
            tempHighC: 20,
            tempLowC: 16,
            condition: 'rain',
            rainProbability: 0.6,
            description: 'light rain',
          },
          {
            date: '2027-04-03',
            tempHighC: 24,
            tempLowC: 18,
            condition: 'sunny',
            rainProbability: 0.1,
            description: 'clear sky',
          },
        ],
        current: {
          tempC: 19,
          feelsLikeC: 18,
          humidity: 68,
          windKph: 11,
          uvIndex: 4,
        },
      },
    }]
    const merged = mergeToolResultsIntoPlan(base, results)
    expect(merged.weatherNotes.some((n) => /Weather:/i.test(n))).toBe(true)
    expect(merged.packingSuggestions.some((p) => /umbrella/i.test(p))).toBe(true)
    expect(merged.travelTips.some((t) => /indoor/i.test(t))).toBe(true)
    expect(merged.dailyItinerary[0]?.weather?.condition).toBe('rain')
    expect(merged.dailyItinerary[0]?.weather?.advice).toMatch(/indoor/i)
    expect(merged.dailyItinerary[1]?.weather?.condition).toBe('sunny')
  })

  it('keeps TravelAgentService provider-blind while still merging weather', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.weatherNotes.length).toBeGreaterThan(0)
    expect(turn.toolBatch?.selected).toContain('weather')
    expect(JSON.stringify(turn.meta)).not.toMatch(/OpenWeatherApiClient|OpenWeatherResponse/)
  })
})

describe('OpenWeatherApiClient integration', () => {
  it('retries rate-limited responses then succeeds', async () => {
    let attempts = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/weather?') || url.includes('/onecall') || url.includes('/uvi')) {
        return new Response(JSON.stringify({ cod: 401 }), { status: 401 })
      }
      attempts += 1
      if (attempts === 1) {
        return new Response('quota', { status: 429 })
      }
      return new Response(JSON.stringify(forecastResponse()), { status: 200 })
    })

    const client = new OpenWeatherApiClient({
      apiKey: 'test-key',
      proxyUrl: null,
      invokeApiKey: null,
      baseUrl: 'https://api.openweathermap.org/data/2.5',
      timeoutMs: 5_000,
      maxRetries: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const snapshot = await client.getWeatherSnapshot('Tokyo')
    expect(snapshot.destination).toMatch(/Tokyo/i)
    expect(snapshot.daily.length).toBeGreaterThan(0)
    expect(attempts).toBe(2)
  })

  it('routes SPA calls through the proxy without embedding the API key', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { operation?: string }
      expect(['forecast', 'current', 'onecall', 'uvi']).toContain(body.operation)
      const headers = init?.headers as Record<string, string>
      expect(JSON.stringify(headers)).not.toMatch(/secret-ow-key/)
      if (body.operation === 'forecast') {
        return new Response(JSON.stringify(forecastResponse()), { status: 200 })
      }
      if (body.operation === 'current') {
        return new Response(JSON.stringify(currentResponse()), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 404 })
    })

    const client = new OpenWeatherApiClient({
      apiKey: null,
      proxyUrl: 'https://example.supabase.co/functions/v1/openweather-proxy',
      invokeApiKey: 'anon-key',
      baseUrl: 'https://api.openweathermap.org/data/2.5',
      timeoutMs: 5_000,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const snapshot = await client.getWeatherSnapshot('Tokyo')
    expect(snapshot.current?.humidity).toBe(68)
    expect(fetchImpl).toHaveBeenCalled()
  })
})
