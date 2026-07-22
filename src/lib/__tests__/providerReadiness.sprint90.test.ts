/**
 * Sprint 90 — Live Provider Integration Readiness tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiKeyExists,
  assertProviderSurface,
  checkSandboxReachable,
  classifyProviderFailure,
  createLiveStubTravelProvider,
  createMockTravelProvider,
  createProviderCircuitBreaker,
  createProviderMetricsStore,
  createProviderRegistry,
  createProviderRetryPolicy,
  createSandboxTravelProvider,
  executeWithFailover,
  probeProviderHealth,
  ProviderError,
  resolveOperatingMode,
  sortProvidersByPriority,
  validateProviderSecrets,
  PROVIDER_SECRET_KEYS,
  SPRINT90_PROVIDER_READINESS_VERSION,
} from '../../core/providers'

describe('Sprint 90 provider surface', () => {
  it('exposes required methods on mock/sandbox/live stubs', () => {
    for (const provider of [
      createMockTravelProvider(),
      createSandboxTravelProvider(),
      createLiveStubTravelProvider(),
    ]) {
      expect(assertProviderSurface(provider)).toEqual([])
      expect(provider.capabilities().flights).toBe(true)
      expect(provider.limits().timeoutMs).toBeGreaterThan(0)
    }
  })

  it('resolves mock / sandbox / live operating modes', () => {
    expect(resolveOperatingMode({ forceMock: true })).toBe('mock')
    expect(resolveOperatingMode({ sandboxEnabled: true })).toBe('sandbox')
    expect(resolveOperatingMode({ liveEnabled: true })).toBe('live')
    expect(resolveOperatingMode({})).toBe('mock')
  })
})

describe('Sprint 90 secrets validator', () => {
  it('requires API keys and reports missing without leaking values', () => {
    const report = validateProviderSecrets({
      providerId: 'amadeus',
      env: { AMADEUS_CLIENT_ID: 'abc', AMADEUS_CLIENT_SECRET: '' },
      requiredKeys: [...PROVIDER_SECRET_KEYS.amadeus.required],
      optionalKeys: [...PROVIDER_SECRET_KEYS.amadeus.optional],
    })
    expect(report.ok).toBe(false)
    expect(report.missingRequired).toContain('AMADEUS_CLIENT_SECRET')
    expect(apiKeyExists({ AMADEUS_CLIENT_ID: 'abc' }, 'AMADEUS_CLIENT_ID')).toBe(true)
    expect(JSON.stringify(report)).not.toMatch(/abc/)
  })

  it('passes when required secrets are loaded', () => {
    const report = validateProviderSecrets({
      providerId: 'duffel',
      env: { DUFFEL_API_TOKEN: 'token' },
      requiredKeys: [...PROVIDER_SECRET_KEYS.duffel.required],
    })
    expect(report.ok).toBe(true)
  })
})

describe('Sprint 90 circuit breaker', () => {
  it('transitions CLOSED → OPEN → HALF_OPEN → CLOSED with recovery', () => {
    let now = 1_000
    const breaker = createProviderCircuitBreaker({
      failureThreshold: 2,
      openMs: 100,
      halfOpenSuccesses: 1,
      clock: () => now,
    })

    expect(breaker.allow('p1')).toBe(true)
    breaker.recordFailure('p1')
    expect(breaker.snapshot('p1').state).toBe('CLOSED')
    breaker.recordFailure('p1')
    expect(breaker.snapshot('p1').state).toBe('OPEN')
    expect(breaker.allow('p1')).toBe(false)

    now += 150
    expect(breaker.allow('p1')).toBe(true)
    expect(breaker.snapshot('p1').state).toBe('HALF_OPEN')

    breaker.recordSuccess('p1')
    expect(breaker.snapshot('p1').state).toBe('CLOSED')
    expect(breaker.snapshot('p1').recoveryCount).toBe(1)
  })
})

describe('Sprint 90 retry policy', () => {
  it('retries network / timeout style failures then succeeds', async () => {
    const sleep = vi.fn(async () => undefined)
    const policy = createProviderRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 1,
      timeoutMs: 200,
      sleep,
    })

    let calls = 0
    const outcome = await policy.execute('retry-demo', async () => {
      calls += 1
      if (calls < 3) throw new Error('fetch failed network')
      return 'ok'
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.value).toBe('ok')
    expect(outcome.attempts).toBe(3)
    expect(outcome.retried).toBe(true)
    expect(sleep).toHaveBeenCalled()
  })

  it('classifies 429 / 5xx / DNS / timeout as retryable', () => {
    expect(classifyProviderFailure('x', new Error('429 rate limit')).code).toBe('RATE_LIMITED')
    expect(classifyProviderFailure('x', new Error('boom'), 503).code).toBe('SERVER_ERROR')
    expect(classifyProviderFailure('x', new Error('getaddrinfo ENOTFOUND')).code).toBe('DNS_FAILURE')
    expect(classifyProviderFailure('x', new Error('timeout')).code).toBe('TIMEOUT')
    expect(classifyProviderFailure('x', new Error('unauthorized'), 401).retryable).toBe(false)
  })
})

describe('Sprint 90 health + sandbox', () => {
  it('probes health for mock provider', async () => {
    const health = await probeProviderHealth(createMockTravelProvider({ latencyMs: 0 }))
    expect(health.ok).toBe(true)
    expect(health.mode).toBe('mock')
  })

  it('marks sandbox reachable via health', async () => {
    const sandbox = createSandboxTravelProvider({ latencyMs: 0 })
    const result = await checkSandboxReachable(sandbox)
    expect(result.reachable).toBe(true)
    expect(result.mode).toBe('sandbox')
  })

  it('reports unreachable sandbox when health fails', async () => {
    const sandbox = createSandboxTravelProvider({ failHealth: true, latencyMs: 0 })
    const result = await checkSandboxReachable(sandbox)
    expect(result.reachable).toBe(false)
  })
})

describe('Sprint 90 priority + failover', () => {
  it('orders primary → secondary → fallback', () => {
    const a = createMockTravelProvider({ id: 'a' })
    const b = createMockTravelProvider({ id: 'b' })
    const c = createMockTravelProvider({ id: 'c' })
    const sorted = sortProvidersByPriority([
      { provider: c, tier: 'fallback', rank: 1 },
      { provider: b, tier: 'secondary', rank: 1 },
      { provider: a, tier: 'primary', rank: 1 },
    ])
    expect(sorted.map((e) => e.provider.id)).toEqual(['a', 'b', 'c'])
  })

  it('fails over from primary to secondary on failure', async () => {
    const primary = createMockTravelProvider({ id: 'primary', failFlights: true, latencyMs: 0 })
    const secondary = createMockTravelProvider({ id: 'secondary', latencyMs: 0 })
    const result = await executeWithFailover(
      [
        { provider: primary, tier: 'primary', rank: 0 },
        { provider: secondary, tier: 'secondary', rank: 0 },
      ],
      async (p) => {
        const out = await p.searchFlights({
          origin: 'RUH',
          destination: 'LHR',
          departureDate: '2026-09-01',
        })
        if (!out.ok) throw new ProviderError({
          code: 'PROVIDER_UNAVAILABLE',
          message: out.error ?? 'fail',
          providerId: p.id,
        })
        return out
      },
    )
    expect(result.ok).toBe(true)
    expect(result.providerId).toBe('secondary')
    expect(result.failoverUsed).toBe(true)
  })
})

describe('Sprint 90 metrics', () => {
  it('tracks availability latency success/failure recovery', () => {
    const metrics = createProviderMetricsStore()
    metrics.recordSuccess('m1', 12)
    metrics.recordSuccess('m1', 8)
    metrics.recordFailure('m1', 40, 'timeout', true)
    metrics.recordRecovery('m1')
    const snap = metrics.snapshot('m1')
    expect(snap.requests).toBe(3)
    expect(snap.successes).toBe(2)
    expect(snap.failures).toBe(1)
    expect(snap.timeouts).toBe(1)
    expect(snap.averageLatencyMs).toBeCloseTo(20, 0)
    expect(snap.successRate).toBeCloseTo(2 / 3, 2)
    expect(snap.recoveryCount).toBe(1)
  })
})

describe('Sprint 90 registry + mock vs live', () => {
  afterEach(() => {
    // no global state
  })

  it('registers providers and runs health snapshot', async () => {
    const registry = createProviderRegistry()
    registry.ensureDefaultMock()
    registry.register(createSandboxTravelProvider({ latencyMs: 0 }), { tier: 'secondary', rank: 1 })
    const snap = await registry.healthCheckAll()
    expect(snap.version).toBe(SPRINT90_PROVIDER_READINESS_VERSION)
    expect(snap.providers.length).toBe(2)
    expect(snap.healthSummary?.healthy).toBe(2)
  })

  it('searchFlightsWithFailover uses secondary when primary empty-fails', async () => {
    const registry = createProviderRegistry()
    registry.register(createMockTravelProvider({ id: 'primary', failFlights: true, latencyMs: 0 }), {
      tier: 'primary',
      rank: 0,
    })
    registry.register(createMockTravelProvider({ id: 'backup', latencyMs: 0 }), {
      tier: 'fallback',
      rank: 0,
    })
    const result = await registry.searchFlightsWithFailover({
      origin: 'RUH',
      destination: 'CDG',
      departureDate: '2026-10-01',
    })
    expect(result.ok).toBe(true)
    expect(result.providerId).toBe('backup')
    expect(registry.metrics.snapshot('primary').failures).toBeGreaterThan(0)
    expect(registry.metrics.snapshot('backup').successes).toBeGreaterThan(0)
  })

  it('supports empty and partial results without throwing', async () => {
    const empty = createMockTravelProvider({ emptyFlights: true, latencyMs: 0 })
    const partial = createMockTravelProvider({ partialHotels: true, latencyMs: 0 })
    const flights = await empty.searchFlights({
      origin: 'RUH',
      destination: 'CAI',
      departureDate: '2026-11-01',
    })
    expect(flights.empty).toBe(true)
    expect(flights.ok).toBe(true)
    const hotels = await partial.searchHotels({
      destination: 'Dubai',
      checkIn: '2026-11-01',
    })
    expect(hotels.partial).toBe(true)
    expect(hotels.results.length).toBe(1)
  })

  it('distinguishes mock vs live stub modes', async () => {
    const mock = createMockTravelProvider()
    const live = createLiveStubTravelProvider()
    expect(mock.mode).toBe('mock')
    expect(live.mode).toBe('live')
    expect(live.capabilities().live).toBe(true)
    expect(mock.capabilities().live).toBe(false)
  })
})
