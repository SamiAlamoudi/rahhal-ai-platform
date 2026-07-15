import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createLiveIntegration,
  createLiveIntegrationEngine,
  createAggregationEngine,
  createProviderRegistry,
  createProviderAdapter,
  createCircuitBreaker,
  createProviderMetrics,
  createProviderSelectionLog,
  createProviderRateLimiter,
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
  mockFallbackIdForLiveProvider,
  resolveLiveProviderEnvironment,
  resolveAmadeusProviderConfig,
  resolveAmadeusEnvironment,
  SANDBOX_HOST,
  PRODUCTION_HOST,
  AmadeusClientCredentialsAuth,
  createMockAmadeusAdapter,
  createMockBookingComAdapter,
  createMockGoogleMapsAdapter,
  createMockOpenWeatherAdapter,
  withRetry,
  DEFAULT_RETRY_POLICY,
} from '../agent/aggregation'
import type { AggregationQuery, ProviderFetchResult } from '../agent/aggregation'

describe('Phase W feature flags', () => {
  it('resolves per-provider flags and mock fallback default on', () => {
    const flags = resolveProviderFeatureFlags({
      mockFallbackEnabled: true,
      amadeusEnvironment: 'sandbox',
      providers: {
        amadeus: true,
        booking_com: false,
        google_maps: false,
        openweather: false,
      },
    })
    expect(flags.mockFallbackEnabled).toBe(true)
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(true)
    expect(isLiveProviderFlagEnabled(flags, 'booking_com')).toBe(false)
    expect(flags.amadeusEnvironment).toBe('sandbox')
    expect(mockFallbackIdForLiveProvider('amadeus')).toBe('amadeus_mock')
  })

  it('disables all live providers when master switch is off', () => {
    const flags = resolveProviderFeatureFlags({
      liveIntegrationEnabled: false,
      providers: {
        amadeus: true,
        booking_com: true,
        google_maps: true,
        openweather: true,
      },
    })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)
    expect(isLiveProviderFlagEnabled(flags, 'google_maps')).toBe(false)
  })
})

describe('Phase W Amadeus sandbox + production + OAuth refresh', () => {
  it('switches Amadeus host via AMADEUS_ENV / resolver', () => {
    expect(resolveAmadeusEnvironment(SANDBOX_HOST)).toBe('sandbox')
    expect(resolveAmadeusEnvironment(PRODUCTION_HOST)).toBe('production')

    const sandbox = resolveAmadeusProviderConfig({
      enabled: true,
      environment: 'sandbox',
      clientId: 'id',
      clientSecret: 'secret',
    })
    expect(sandbox.environment).toBe('sandbox')
    expect(sandbox.baseUrl).toContain('test.api.amadeus.com')

    const prod = resolveAmadeusProviderConfig({
      enabled: true,
      environment: 'production',
      clientId: 'id',
      clientSecret: 'secret',
    })
    expect(prod.environment).toBe('production')
    expect(prod.baseUrl).toContain('api.amadeus.com')
  })

  it('refreshes OAuth access tokens via refreshToken()', async () => {
    let tokenSeq = 0
    const fetchMock = vi.fn(async () => {
      const access_token = `tok_${tokenSeq}`
      tokenSeq += 1
      return new Response(JSON.stringify({
        access_token,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const auth = new AmadeusClientCredentialsAuth({
      clientId: 'cid',
      clientSecret: 'csecret',
      baseUrl: SANDBOX_HOST,
      timeout: 2000,
    })
    const first = await auth.getToken()
    expect(first.fromCache).toBe(false)
    expect(first.token?.accessToken).toBe('tok_0')

    const cached = await auth.getToken()
    expect(cached.fromCache).toBe(true)

    const refreshed = await auth.refreshToken()
    expect(refreshed.fromCache).toBe(false)
    expect(refreshed.token?.accessToken).toBe('tok_1')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('resolveLiveProviderEnvironment honors sandbox/production flags', () => {
    expect(resolveLiveProviderEnvironment({
      liveIntegrationEnabled: true,
      mockFallbackEnabled: true,
      providers: { amadeus: true, booking_com: false, google_maps: false, openweather: false },
      amadeusEnvironment: 'production',
    }).amadeusBaseUrl).toBe(PRODUCTION_HOST)

    expect(resolveLiveProviderEnvironment({
      liveIntegrationEnabled: true,
      mockFallbackEnabled: true,
      providers: { amadeus: true, booking_com: false, google_maps: false, openweather: false },
      amadeusEnvironment: 'sandbox',
    }).amadeus).toBe('sandbox')
  })
})

describe('Phase W circuit breaker / rate limit / metrics / selection logs', () => {
  it('opens circuit after consecutive failures and recovers on half-open success', () => {
    let now = 1_000
    const breaker = createCircuitBreaker({
      failureThreshold: 2,
      openMs: 100,
      halfOpenSuccesses: 1,
      clock: () => now,
    })
    expect(breaker.allow('amadeus')).toBe(true)
    breaker.recordFailure('amadeus')
    expect(breaker.allow('amadeus')).toBe(true)
    breaker.recordFailure('amadeus')
    expect(breaker.snapshot('amadeus').state).toBe('open')
    expect(breaker.allow('amadeus')).toBe(false)

    now += 150
    expect(breaker.allow('amadeus')).toBe(true)
    expect(breaker.snapshot('amadeus').state).toBe('half_open')
    breaker.recordSuccess('amadeus')
    expect(breaker.snapshot('amadeus').state).toBe('closed')
  })

  it('rate-limits providers proactively', () => {
    const limiter = createProviderRateLimiter({ defaultPerMinute: 2 })
    expect(limiter.allow('booking_com').allowed).toBe(true)
    expect(limiter.allow('booking_com').allowed).toBe(true)
    const third = limiter.allow('booking_com')
    expect(third.allowed).toBe(false)
    expect(third.retryAfterMs).toBeGreaterThan(0)
  })

  it('records metrics and selection logs', () => {
    const metrics = createProviderMetrics()
    const log = createProviderSelectionLog()
    metrics.recordRequest('google_maps', { status: 'ok', durationMs: 12 })
    metrics.recordRequest('google_maps', { status: 'timeout', durationMs: 50, retries: 1 })
    const snap = metrics.snapshot('google_maps')[0]
    expect(snap.requests).toBe(2)
    expect(snap.successes).toBe(1)
    expect(snap.timeouts).toBe(1)
    expect(snap.retries).toBe(1)

    log.append({
      level: 'info',
      domain: 'maps',
      event: 'provider.selected',
      message: 'Selected google_maps',
      providerId: 'google_maps',
      strategy: 'priority_fallback',
      metadata: { geocode: true, places: true, distance_matrix: true },
    })
    expect(log.list(1)[0]?.providerId).toBe('google_maps')
  })
})

describe('Phase W fallback / retry / timeout', () => {
  function failingThenMock(liveId: string) {
    const live = createProviderAdapter({
      metadata: {
        id: liveId,
        displayName: 'Live failing',
        domains: ['flights'],
        priority: 95,
        reliability: 0.9,
        mocked: false,
      },
      isAvailable: () => true,
      capabilities: {
        features: ['live'],
        supportsSearch: true,
        supportsRealtime: true,
        rateLimitPerMinute: 60,
        mocked: false,
        futureSlot: false,
      },
      async fetch(): Promise<ProviderFetchResult> {
        return {
          providerId: liveId,
          status: 'error',
          items: [],
          error: 'upstream_down',
          errorCode: 'upstream_error',
          durationMs: 5,
        }
      },
    })
    return live
  }

  it('falls back automatically from live failure to mock', async () => {
    const live = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: true,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
      extraAdapters: [failingThenMock('amadeus_live_test')],
    })

    // Register failing high-priority + mock amadeus
    live.registry.register(failingThenMock('amadeus_live_test'))
    live.registry.register(createMockAmadeusAdapter())

    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: {
        selectionLog: live.selectionLog,
        metrics: live.metrics,
      },
    })

    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1 },
    })

    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.providerResults.some((p) => p.providerId.includes('mock') || p.status === 'ok')).toBe(true)
    expect(live.selectionLog.list().some((e) => e.event === 'selection.fallback')).toBe(true)
  })

  it('retries retryable failures then succeeds', async () => {
    let attempts = 0
    const { value, attempts: used } = await withRetry({
      policy: { ...DEFAULT_RETRY_POLICY, maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      shouldRetry: () => true,
      run: async (attempt) => {
        attempts = attempt
        if (attempt < 3) {
          throw Object.assign(new Error('transient'), { retryable: true })
        }
        return 'ok'
      },
    })
    expect(value).toBe('ok')
    expect(used).toBe(3)
    expect(attempts).toBe(3)
  })

  it('times out slow providers', async () => {
    const slow = createProviderAdapter({
      metadata: {
        id: 'slow_maps',
        displayName: 'Slow',
        domains: ['maps'],
        priority: 90,
        reliability: 0.5,
        mocked: false,
      },
      isAvailable: () => true,
      capabilities: {
        features: ['geocode'],
        supportsSearch: true,
        supportsRealtime: true,
        rateLimitPerMinute: 10,
        mocked: false,
        futureSlot: false,
      },
      async fetch() {
        await new Promise((r) => setTimeout(r, 80))
        return {
          providerId: 'slow_maps',
          status: 'ok',
          items: [],
          durationMs: 80,
        }
      },
    })
    const engine = createAggregationEngine({
      registry: createProviderRegistry([slow, createMockGoogleMapsAdapter()]),
      providerTimeoutMs: 15,
      selectionStrategy: 'priority_fallback',
    })
    const result = await engine.aggregate({
      domain: 'maps',
      locale: 'en',
      input: { destination: 'Riyadh' },
      selectionStrategy: 'priority_fallback',
    })
    expect(result.providerResults.some((p) => p.providerId === 'slow_maps' && p.status === 'timeout')).toBe(true)
    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
  })
})

describe('Phase W provider contracts (mock integration)', () => {
  beforeEach(() => {
    // Keep live flags off so contracts exercise mock adapters.
  })

  it('boots live integration engine with mock flights/hotels/maps/weather', async () => {
    const ctx = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: true,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
        amadeusEnvironment: 'sandbox',
      },
    })

    const ids = ctx.registry.list().map((m) => String(m.id))
    expect(ids).toEqual(expect.arrayContaining([
      'amadeus_mock',
      'booking_com_mock',
      'google_maps_mock',
      'openweather_mock',
    ]))

    const engine = ctx.engine
    const query = (domain: AggregationQuery['domain'], input: Record<string, unknown>) =>
      engine.aggregate({ domain, locale: 'en', input, selectionStrategy: 'priority_fallback' })

    const flights = await query('flights', { origin: 'RUH', destination: 'JED', travelers: 1 })
    expect(flights.items.length).toBeGreaterThan(0)

    const hotels = await query('hotels', { destination: 'Jeddah', travelers: 2 })
    expect(hotels.items.length).toBeGreaterThan(0)

    const maps = await query('maps', { destination: 'Jeddah' })
    expect(maps.providerResults.length).toBeGreaterThan(0)

    const weather = await query('weather', { destination: 'Jeddah' })
    expect(weather.providerResults.length).toBeGreaterThan(0)

    expect(ctx.selectionLog.list().some((e) => e.event === 'live_integration.boot')).toBe(true)
    expect(createLiveIntegrationEngine({
      flags: {
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
    })).toBeTruthy()
  })

  it('exposes mock contract adapters for each live domain', async () => {
    const adapters = [
      createMockAmadeusAdapter(),
      createMockBookingComAdapter(),
      createMockGoogleMapsAdapter(),
      createMockOpenWeatherAdapter(),
    ]
    for (const adapter of adapters) {
      expect(adapter.getCapabilities().mocked).toBe(true)
      expect(adapter.isAvailable()).toBe(true)
      const domain = adapter.metadata.domains[0]
      const result = await adapter.fetch({
        domain,
        locale: 'en',
        input: { origin: 'RUH', destination: 'DXB', travelers: 1 },
      })
      expect(result.providerId).toBe(String(adapter.metadata.id))
      expect(['ok', 'skipped']).toContain(result.status)
    }
  })

  it('circuit-breaks a wrapped live adapter and continues via mock fallback', async () => {
    const ctx = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: true,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
    })

    const flakyId = 'flaky_live'
    let calls = 0
    const flaky = createProviderAdapter({
      metadata: {
        id: flakyId,
        displayName: 'Flaky',
        domains: ['hotels'],
        priority: 99,
        reliability: 0.5,
        mocked: false,
      },
      isAvailable: () => true,
      capabilities: {
        features: [],
        supportsSearch: true,
        supportsRealtime: false,
        rateLimitPerMinute: 100,
        mocked: false,
        futureSlot: false,
      },
      async fetch() {
        calls += 1
        return {
          providerId: flakyId,
          status: 'error',
          items: [],
          error: 'boom',
          errorCode: 'upstream_error',
          durationMs: 1,
        }
      },
    })

    // Wrap manually with same hooks
    const { wrapAdapterForLiveIntegration } = await import('../agent/aggregation/liveIntegration/wrapAdapter')
    const wrapped = wrapAdapterForLiveIntegration(flaky, {
      flags: ctx.flags,
      circuitBreaker: ctx.circuitBreaker,
      rateLimiter: ctx.rateLimiter,
      metrics: ctx.metrics,
      selectionLog: ctx.selectionLog,
    })
    ctx.registry.register(wrapped)

    const engine = createAggregationEngine({
      registry: ctx.registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
      liveIntegration: {
        circuitBreaker: ctx.circuitBreaker,
        metrics: ctx.metrics,
        selectionLog: ctx.selectionLog,
      },
    })

    for (let i = 0; i < 3; i += 1) {
      await engine.aggregate({
        domain: 'hotels',
        locale: 'en',
        input: { destination: 'Paris' },
        selectionStrategy: 'priority_fallback',
      })
    }

    expect(ctx.circuitBreaker.snapshot(flakyId).state).toBe('open')
    const blocked = await wrapped.fetch({
      domain: 'hotels',
      locale: 'en',
      input: { destination: 'Paris' },
    })
    expect(blocked.errorCode).toBe('unavailable')
    expect(blocked.error).toMatch(/circuit/i)
    expect(calls).toBeGreaterThanOrEqual(2)
  })
})
