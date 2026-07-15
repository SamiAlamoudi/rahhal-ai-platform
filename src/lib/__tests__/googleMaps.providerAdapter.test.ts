import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createGoogleMapsProviderAdapter,
  createAggregationEngine,
  createProviderRegistry,
  createMockGoogleMapsAdapter,
  createMockOpenStreetMapAdapter,
  resolveGoogleMapsProviderConfig,
  isGoogleMapsConfigured,
  routeLegsToNormalizedOffers,
  createDefaultProviderAdapters,
} from '../agent/aggregation'
import type { CanonicalRouteLeg } from '../../integrations/providers/googleMaps/types'
import { GoogleMapsApiClient } from '../../integrations/providers/googleMaps/googleMapsApiClient'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
import type { ChatMessage } from '../chat/chatTypes'

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

function tokyoLocation() {
  return {
    results: [{
      place_id: 'ChIJPX4',
      formatted_address: 'Tokyo, Japan',
      name: 'Tokyo',
      geometry: { location: { lat: 35.6762, lng: 139.6503 } },
      address_components: [
        { long_name: 'Tokyo', short_name: 'Tokyo', types: ['locality'] },
        { long_name: 'Japan', short_name: 'JP', types: ['country'] },
      ],
      types: ['locality', 'political'],
    }],
    status: 'OK',
  }
}

function kyotoLocation() {
  return {
    results: [{
      place_id: 'ChIJx',
      formatted_address: 'Kyoto, Japan',
      name: 'Kyoto',
      geometry: { location: { lat: 35.0116, lng: 135.7681 } },
      address_components: [
        { long_name: 'Kyoto', short_name: 'Kyoto', types: ['locality'] },
        { long_name: 'Japan', short_name: 'JP', types: ['country'] },
      ],
      types: ['locality', 'political'],
    }],
    status: 'OK',
  }
}

describe('Phase P Google Maps ProviderAdapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete process.env.GOOGLE_MAPS_API_KEY
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete process.env.GOOGLE_MAPS_API_KEY
    vi.restoreAllMocks()
  })

  it('is unavailable without API key or proxy', () => {
    const config = resolveGoogleMapsProviderConfig({
      enabled: true,
      apiKey: null,
      proxyUrl: null,
      invokeApiKey: null,
    })
    expect(isGoogleMapsConfigured(config)).toBe(false)
    const adapter = createGoogleMapsProviderAdapter({ config })
    expect(adapter.isAvailable()).toBe(false)
    expect(adapter.metadata.id).toBe('google_maps')
    expect(adapter.metadata.mocked).toBe(false)
  })

  it('becomes available with server-side API key (never VITE_*)', () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-key'
    const config = resolveGoogleMapsProviderConfig({ enabled: true })
    expect(config.apiKey).toBe('test-google-key')
    expect(isGoogleMapsConfigured(config)).toBe(true)
    const adapter = createGoogleMapsProviderAdapter({ config })
    expect(adapter.isAvailable()).toBe(true)
    expect(adapter.getCapabilities().features).toEqual(expect.arrayContaining([
      'geocode',
      'reverse_geocode',
      'place_search',
      'distance_matrix',
      'timezone',
      'airport_lookup',
      'route_legs',
    ]))
  })

  it('never reads Maps API keys from VITE_* env vars', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'leaked-key')
    const config = resolveGoogleMapsProviderConfig({
      enabled: true,
      apiKey: null,
      proxyUrl: null,
      invokeApiKey: null,
    })
    expect(config.apiKey).toBeNull()
    expect(isGoogleMapsConfigured(config)).toBe(false)
  })

  it('normalizes route legs into canonical agent payload (no Google types)', () => {
    const legs: CanonicalRouteLeg[] = [{
      from: 'Tokyo',
      to: 'Kyoto',
      mode: 'transit',
      distanceKm: 450.2,
      durationMinutes: 135,
      fromLocation: null,
      toLocation: null,
    }]
    const normalized = routeLegsToNormalizedOffers(legs, 'google_maps')
    expect(normalized).toHaveLength(1)
    expect(normalized[0].domain).toBe('maps')
    expect(normalized[0].payload).toMatchObject({
      from: 'Tokyo',
      to: 'Kyoto',
      mode: 'transit',
      distanceKm: 450.2,
      durationMinutes: 135,
      source: 'google_maps',
    })
    expect(JSON.stringify(normalized[0])).not.toMatch(/address_components|geometry|OVER_QUERY_LIMIT/)
  })

  it('geocodes + distance-matrix via client and returns canonical legs', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/timezone/')) {
        return new Response(JSON.stringify({ status: 'OK', timeZoneId: 'Asia/Tokyo' }), { status: 200 })
      }
      if (url.includes('/distancematrix/')) {
        return new Response(JSON.stringify({
          status: 'OK',
          rows: [{
            elements: [{
              status: 'OK',
              distance: { value: 513_000 },
              duration: { value: 8_100 },
            }],
          }],
        }), { status: 200 })
      }
      if (url.includes('address=Kyoto') || url.includes('address=Kyoto%2C')) {
        return new Response(JSON.stringify(kyotoLocation()), { status: 200 })
      }
      return new Response(JSON.stringify(tokyoLocation()), { status: 200 })
    })

    const client = new GoogleMapsApiClient({
      apiKey: 'test-key',
      proxyUrl: null,
      invokeApiKey: null,
      timeoutMs: 5_000,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const adapter = createGoogleMapsProviderAdapter({
      config: { enabled: true, apiKey: 'test-key' },
      deps: { client },
    })

    const result = await adapter.fetch({
      domain: 'maps',
      locale: 'en',
      input: { destination: 'Japan', hubs: ['Tokyo', 'Kyoto'] },
    })

    expect(result.status).toBe('ok')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.payload).toMatchObject({
      from: 'Tokyo',
      to: 'Kyoto',
      mode: 'transit',
      source: 'google_maps',
    })
    expect(Number(result.items[0]?.payload.distanceKm)).toBeGreaterThan(100)
    expect(Number(result.items[0]?.payload.durationMinutes)).toBeGreaterThan(60)
    // Response must stay canonical
    expect(JSON.stringify(result.items)).not.toMatch(/address_components/)
  })

  it('supports destination / airport / hotel / attraction lookups', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/timezone/')) {
        return new Response(JSON.stringify({ status: 'OK', timeZoneId: 'Asia/Tokyo' }), { status: 200 })
      }
      if (url.includes('/place/textsearch')) {
        const type = new URL(url).searchParams.get('type')
        const name = type === 'airport'
          ? 'Haneda Airport'
          : type === 'lodging'
            ? 'Park Hotel Tokyo'
            : type === 'tourist_attraction'
              ? 'Senso-ji'
              : 'Tokyo'
        return new Response(JSON.stringify({
          status: 'OK',
          results: [{
            place_id: `pid_${type}`,
            name,
            formatted_address: `${name}, Tokyo, Japan`,
            geometry: { location: { lat: 35.67, lng: 139.76 } },
            types: type ? [type, 'point_of_interest'] : ['locality'],
            address_components: [
              { long_name: 'Tokyo', short_name: 'Tokyo', types: ['locality'] },
              { long_name: 'Japan', short_name: 'JP', types: ['country'] },
            ],
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify(tokyoLocation()), { status: 200 })
    })

    const client = new GoogleMapsApiClient({
      apiKey: 'test-key',
      proxyUrl: null,
      invokeApiKey: null,
      timeoutMs: 5_000,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const adapter = createGoogleMapsProviderAdapter({
      config: { enabled: true, apiKey: 'test-key' },
      deps: { client },
    })

    const dest = await adapter.searchDestination('Tokyo')
    expect(dest[0]?.name).toBeTruthy()
    expect(dest[0]?.lat).toBeCloseTo(35.67, 1)

    const airport = await adapter.lookupAirport('Haneda')
    expect(airport?.types).toContain('airport')
    expect(airport?.timezoneId).toBe('Asia/Tokyo')

    const hotel = await adapter.lookupHotel('Park Hotel', 'Tokyo')
    expect(hotel?.name).toMatch(/Park Hotel/i)
    expect(hotel?.lat).not.toBeNull()

    const attraction = await adapter.lookupAttraction('Senso-ji', 'Tokyo')
    expect(attraction?.name).toMatch(/Senso/i)

    const city = await adapter.lookupCity('Tokyo')
    expect(city?.city || city?.name).toBeTruthy()

    const coords = await adapter.normalizeCoordinates(35.6762, 139.6503)
    expect(coords?.formattedAddress || coords?.label).toBeTruthy()
  })

  it('falls back from Google Maps to mock maps when Google fails', async () => {
    const google = createGoogleMapsProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'google_maps',
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
      google,
      createMockOpenStreetMapAdapter(),
      createMockGoogleMapsAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })

    const result = await engine.aggregate({
      domain: 'maps',
      locale: 'en',
      input: { destination: 'Japan', hubs: ['Tokyo', 'Kyoto'] },
      selectionStrategy: 'priority_fallback',
    })

    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults.some((p) => p.providerId === 'google_maps' && p.status === 'error')).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]?.payload).toMatchObject({
      from: expect.any(String),
      to: expect.any(String),
      distanceKm: expect.any(Number),
      durationMinutes: expect.any(Number),
    })
  })

  it('uses Google Maps results when the real adapter succeeds', async () => {
    const google = createGoogleMapsProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'google_maps',
            status: 'ok',
            items: routeLegsToNormalizedOffers([{
              from: 'Tokyo Station',
              to: 'Kyoto Station',
              mode: 'transit',
              distanceKm: 513,
              durationMinutes: 135,
              fromLocation: null,
              toLocation: null,
            }], 'google_maps'),
            durationMs: 12,
          }
        },
      },
    })
    const registry = createProviderRegistry([
      google,
      createMockOpenStreetMapAdapter(),
      createMockGoogleMapsAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
    })
    const result = await engine.aggregate({
      domain: 'maps',
      locale: 'en',
      input: { destination: 'Japan', hubs: ['Tokyo', 'Kyoto'] },
    })
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults).toHaveLength(1)
    expect(result.items[0]?.payload.from).toBe('Tokyo Station')
    expect(result.items[0]?.providerId).toBe('google_maps')
  })

  it('handles rate-limit responses from Google Maps', async () => {
    const google = createGoogleMapsProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'google_maps',
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
    const result = await google.fetch({
      domain: 'maps',
      locale: 'en',
      input: { destination: 'Japan' },
    })
    expect(result.status).toBe('rate_limited')
    expect(result.errorCode).toBe('rate_limited')
  })

  it('registers google_maps ahead of google_maps_mock in the default set', () => {
    const adapters = createDefaultProviderAdapters()
    const maps = adapters.filter((a) => a.supports('maps') && !a.metadata.futureSlot)
    const ids = maps.map((a) => a.metadata.id)
    expect(ids).toEqual(expect.arrayContaining(['google_maps', 'google_maps_mock', 'openstreetmap']))
    const live = maps.find((a) => a.metadata.id === 'google_maps')
    const mock = maps.find((a) => a.metadata.id === 'google_maps_mock')
    expect(live?.metadata.priority ?? 0).toBeGreaterThan(mock?.metadata.priority ?? 0)
  })

  it('keeps TravelAgentService provider-blind while still merging map legs', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.transportation.length).toBeGreaterThan(0)
    expect(turn.toolBatch?.selected).toContain('maps')
    expect(JSON.stringify(turn.meta)).not.toMatch(/GoogleMapsApiClient|maps\.googleapis\.com/)
  })
})

describe('GoogleMapsApiClient integration', () => {
  it('retries rate-limited responses then succeeds', async () => {
    let attempts = 0
    const fetchImpl = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) {
        return new Response(JSON.stringify({ status: 'OVER_QUERY_LIMIT' }), { status: 200 })
      }
      return new Response(JSON.stringify(tokyoLocation()), { status: 200 })
    })

    const client = new GoogleMapsApiClient({
      apiKey: 'test-key',
      proxyUrl: null,
      invokeApiKey: null,
      timeoutMs: 5_000,
      maxRetries: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const results = await client.geocode('Tokyo')
    expect(results[0]?.name || results[0]?.label).toMatch(/Tokyo/i)
    expect(attempts).toBe(2)
  })

  it('routes SPA calls through the proxy without embedding the Maps API key', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { operation?: string }
      expect(body.operation).toBe('geocode')
      const headers = init?.headers as Record<string, string>
      expect(JSON.stringify(headers)).not.toMatch(/test-google-secret/)
      return new Response(JSON.stringify(tokyoLocation()), { status: 200 })
    })

    const client = new GoogleMapsApiClient({
      apiKey: null,
      proxyUrl: 'https://example.supabase.co/functions/v1/google-maps-proxy',
      invokeApiKey: 'anon-key',
      timeoutMs: 5_000,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const results = await client.geocode('Tokyo')
    expect(results[0]?.countryCode).toBe('JP')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
