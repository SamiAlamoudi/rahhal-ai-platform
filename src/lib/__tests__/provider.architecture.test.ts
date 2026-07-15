import { describe, it, expect, vi } from 'vitest'
import {
  createAggregationEngine,
  createProviderRegistry,
  createProviderAdapter,
  createMockAmadeusAdapter,
  createMockDuffelAdapter,
  createMockRome2RioAdapter,
  createDefaultMockProviderAdapters,
  createFutureProviderStubs,
  createUnavailableProviderStub,
  normalizeProviderError,
  FUTURE_PROVIDER_CATALOG,
  createProviderHealthTracker,
  selectProviders,
  createDefaultAggregationEngine,
} from '../agent/aggregation'
import * as providerFacade from '../agent/providers'

describe('Phase M provider adapter architecture', () => {
  it('exposes a common ProviderAdapter interface on every mock adapter', () => {
    for (const adapter of createDefaultMockProviderAdapters()) {
      expect(adapter.metadata.id).toBeTruthy()
      expect(typeof adapter.isAvailable).toBe('function')
      expect(typeof adapter.supports).toBe('function')
      expect(typeof adapter.getCapabilities).toBe('function')
      expect(typeof adapter.getHealth).toBe('function')
      expect(typeof adapter.fetch).toBe('function')
      const caps = adapter.getCapabilities()
      expect(caps.providerId).toBe(String(adapter.metadata.id))
      expect(caps.domains.length).toBeGreaterThan(0)
      expect(Array.isArray(caps.features)).toBe(true)
    }
  })

  it('registers flights hotels attractions weather maps currency visa transportation domains', () => {
    const registry = createProviderRegistry(createDefaultMockProviderAdapters())
    const domains = new Set(registry.list().flatMap((m) => m.domains))
    expect([...domains].sort()).toEqual([
      'attractions',
      'currency',
      'flights',
      'hotels',
      'maps',
      'transportation',
      'visa',
      'weather',
    ].sort())
  })

  it('supports capability discovery for active and future providers', () => {
    const registry = createProviderRegistry(createDefaultMockProviderAdapters())
    const all = registry.discoverCapabilities()
    expect(all.length).toBeGreaterThan(10)
    const flights = registry.discoverCapabilities('flights')
    const ids = flights.map((c) => c.providerId)
    expect(ids).toEqual(expect.arrayContaining(['amadeus', 'duffel', 'skyscanner']))
    expect(flights.find((c) => c.providerId === 'skyscanner')?.futureSlot).toBe(true)
    expect(FUTURE_PROVIDER_CATALOG.map((f) => f.id)).toEqual(expect.arrayContaining([
      'skyscanner',
      'hotelbeds',
      'mapbox',
      'tomorrow_io',
      'sherpa',
      'google_places',
      'viator',
      'getyourguide',
    ]))
    expect(createFutureProviderStubs().every((a) => !a.isAvailable())).toBe(true)
  })

  it('selects providers by priority and excludes unavailable/future slots', () => {
    const registry = createProviderRegistry([
      createMockAmadeusAdapter(),
      createMockDuffelAdapter(),
      createUnavailableProviderStub('skyscanner', 'Skyscanner', ['flights'], ['search']),
    ])
    const selected = registry.select({ domain: 'flights' })
    expect(selected.map((a) => a.metadata.id)).toEqual(['amadeus', 'duffel'])
    expect(selected[0].metadata.priority).toBeGreaterThan(selected[1].metadata.priority)
    expect(selectProviders(registry, { domain: 'flights' })).toHaveLength(2)
  })

  it('uses automatic priority fallback when the top provider fails', async () => {
    const failingAmadeus = createProviderAdapter({
      metadata: {
        id: 'amadeus',
        displayName: 'Amadeus fail',
        domains: ['flights'],
        priority: 90,
        reliability: 0.9,
        mocked: true,
      },
      async fetch() {
        throw new Error('upstream_down')
      },
    })
    const registry = createProviderRegistry([
      failingAmadeus,
      createMockDuffelAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'USD' },
    })
    expect(result.meta.selectionStrategy).toBe('priority_fallback')
    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.providerResults.some((p) => p.providerId === 'duffel' && p.status === 'ok')).toBe(true)
  })

  it('enforces per-provider timeout handling', async () => {
    const slow = createProviderAdapter({
      metadata: {
        id: 'slow_provider',
        displayName: 'Slow',
        domains: ['flights'],
        priority: 50,
        reliability: 0.5,
        mocked: true,
      },
      async fetch() {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return {
          providerId: 'slow_provider',
          status: 'ok',
          items: [],
          durationMs: 200,
        }
      },
    })
    const registry = createProviderRegistry([slow])
    const engine = createAggregationEngine({
      registry,
      providerTimeoutMs: 30,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { destination: 'Japan' },
    })
    expect(result.providerResults[0]?.status).toBe('timeout')
    expect(result.providerResults[0]?.errorCode).toBe('timeout')
  })

  it('retries retryable failures according to policy', async () => {
    let attempts = 0
    const flaky = createProviderAdapter({
      metadata: {
        id: 'flaky',
        displayName: 'Flaky',
        domains: ['currency'],
        priority: 50,
        reliability: 0.5,
        mocked: true,
      },
      async fetch() {
        attempts += 1
        if (attempts < 2) throw new Error('upstream_error temporary')
        return {
          providerId: 'flaky',
          status: 'ok',
          items: [{
            domain: 'currency',
            fingerprint: 'fx:ok',
            title: 'ok',
            price: 1,
            currency: 'USD',
            providerId: 'flaky',
            confidence: 1,
            rankScore: 0,
            scoreHints: {},
            payload: { convertedAmount: 1, rate: 1, amount: 1, fromCurrency: 'USD', toCurrency: 'USD' },
          }],
          durationMs: 1,
        }
      },
    })
    const registry = createProviderRegistry([flaky])
    const engine = createAggregationEngine({
      registry,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    })
    const result = await engine.aggregate({
      domain: 'currency',
      locale: 'en',
      input: { amount: 1, fromCurrency: 'USD', toCurrency: 'USD' },
    })
    expect(attempts).toBe(2)
    expect(result.meta.retries).toBeGreaterThanOrEqual(1)
    expect(result.meta.providersSucceeded).toBe(1)
  })

  it('normalizes provider errors including rate limits', () => {
    expect(normalizeProviderError(new Error('provider_timeout')).code).toBe('timeout')
    expect(normalizeProviderError(new Error('rate limit 429')).code).toBe('rate_limited')
    expect(normalizeProviderError(new Error('rate limit 429')).retryable).toBe(true)
    expect(normalizeProviderError(new Error('aborted')).code).toBe('aborted')
    expect(normalizeProviderError('not_configured').code).toBe('not_configured')
  })

  it('handles rate-limited providers with cool-down health state', async () => {
    const limited = createProviderAdapter({
      metadata: {
        id: 'limited',
        displayName: 'Limited',
        domains: ['visa'],
        priority: 50,
        reliability: 0.5,
        mocked: true,
      },
      async fetch() {
        return {
          providerId: 'limited',
          status: 'rate_limited',
          items: [],
          error: 'rate_limited',
          errorCode: 'rate_limited',
          retryAfterMs: 5_000,
          durationMs: 1,
        }
      },
    })
    const registry = createProviderRegistry([limited])
    const engine = createAggregationEngine({
      registry,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
      rateLimitPolicy: { defaultPerMinute: 60, coolDownMs: 5_000 },
    })
    const result = await engine.aggregate({
      domain: 'visa',
      locale: 'en',
      input: { destination: 'Japan', nationality: 'SA' },
    })
    expect(result.providerResults[0]?.status).toBe('rate_limited')
    const health = registry.getHealthStatus('limited')[0]
    expect(health.status).toBe('degraded')
    expect(health.rateLimitedUntil).toBeTruthy()
  })

  it('tracks health status across outcomes', () => {
    const tracker = createProviderHealthTracker()
    tracker.record('amadeus', {
      providerId: 'amadeus',
      status: 'error',
      items: [],
      errorCode: 'upstream_error',
      durationMs: 1,
    })
    tracker.record('amadeus', {
      providerId: 'amadeus',
      status: 'error',
      items: [],
      errorCode: 'upstream_error',
      durationMs: 1,
    })
    tracker.record('amadeus', {
      providerId: 'amadeus',
      status: 'error',
      items: [],
      errorCode: 'upstream_error',
      durationMs: 1,
    })
    expect(tracker.snapshot('amadeus').status).toBe('unhealthy')
    tracker.record('amadeus', {
      providerId: 'amadeus',
      status: 'ok',
      items: [],
      durationMs: 1,
    })
    expect(tracker.snapshot('amadeus').status).toBe('healthy')
  })

  it('aggregates transportation via Rome2Rio mock without exposing vendor to caller meta shape', async () => {
    const registry = createProviderRegistry([createMockRome2RioAdapter()])
    const engine = createAggregationEngine({ registry })
    const result = await engine.aggregate({
      domain: 'transportation',
      locale: 'en',
      input: { destination: 'Japan', origin: 'RUH', hubs: ['Tokyo', 'Kyoto'], currency: 'USD' },
    })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0].domain).toBe('transportation')
    expect(result.providerResults[0]?.providerId).toBe('rome2rio')
  })

  it('keeps default engine mock-backed and provider-facade exportable', async () => {
    const engine = createDefaultAggregationEngine()
    const flights = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'USD' },
    })
    expect(flights.meta.providersSucceeded).toBeGreaterThan(0)
    expect(providerFacade.createMockAmadeusAdapter().metadata.mocked).toBe(true)
    expect(providerFacade.FUTURE_PROVIDER_CATALOG.length).toBeGreaterThan(0)
  })

  it('marks unhealthy providers so selection skips them', async () => {
    vi.useFakeTimers()
    const registry = createProviderRegistry([
      createMockAmadeusAdapter(),
      createMockDuffelAdapter(),
    ])
    for (let i = 0; i < 3; i += 1) {
      registry.recordOutcome('amadeus', {
        providerId: 'amadeus',
        status: 'error',
        items: [],
        errorCode: 'upstream_error',
        durationMs: 1,
      })
    }
    expect(registry.getHealthStatus('amadeus')[0]?.status).toBe('unhealthy')
    const selected = registry.select({ domain: 'flights', excludeUnhealthy: true })
    expect(selected.map((a) => a.metadata.id)).toEqual(['duffel'])
    vi.useRealTimers()
  })
})
