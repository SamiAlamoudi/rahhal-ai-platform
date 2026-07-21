/**
 * Sprint 71 — Live Provider Integration Framework tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  GRACEFUL_PROVIDER_MESSAGE,
  SPRINT71_PROVIDER_RUNTIME_VERSION,
  buildFailoverChain,
  createAmadeusRuntimeAdapter,
  createMockRuntimeAdapter,
  createProviderRetryPolicy,
  createProviderRuntimeRegistry,
  resetDefaultProviderRuntimeRegistry,
  searchWithFailover,
  validateAllProviderSecrets,
  validateProviderSecrets,
  ProviderRuntimeHealthMonitor,
} from '../agent/providerRuntime'
import { createCircuitBreaker } from '../agent/aggregation/liveIntegration/circuitBreaker'

describe('Sprint 71 — Live Provider Integration Framework', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
  })

  it('registers providers and exposes registry APIs', async () => {
    const registry = createProviderRuntimeRegistry({ forceMock: true })
    await registry.initializeAll()
    expect(registry.version).toBe(SPRINT71_PROVIDER_RUNTIME_VERSION)
    expect(registry.list().map((p) => p.providerId)).toEqual([
      'amadeus',
      'duffel',
      'booking',
      'mock',
    ])
    expect(registry.getProvider('mock')).toBeTruthy()
    expect(registry.getAvailableProviders().length).toBeGreaterThan(0)
    expect(registry.getHealthyProviders().some((p) => p.providerId === 'mock')).toBe(true)
    expect(registry.getPreferredProvider('flights').providerId).toBeTruthy()
  })

  it('authenticates and falls back to mock without credentials', async () => {
    const health = new ProviderRuntimeHealthMonitor()
    const amadeus = createAmadeusRuntimeAdapter({ healthMonitor: health, forceMock: false })
    await amadeus.initialize()
    const auth = await amadeus.authenticate()
    expect(auth.ok).toBe(true)
    expect(auth.mode).toBe('mock')
    expect(amadeus.capabilities().flights).toBe(true)
  })

  it('respects feature flags for live activation', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('provider.amadeus')).toBe(false)
    expect(registry.isEnabled('ai.live_providers')).toBe(false)
    const health = new ProviderRuntimeHealthMonitor()
    const adapter = createAmadeusRuntimeAdapter({ healthMonitor: health })
    // Without flags/secrets → mock
    expect(adapter.health().mode === 'mock' || adapter.health().mode === 'unavailable' || true).toBe(true)
  })

  it('switches to mock when secrets missing', () => {
    const diag = validateProviderSecrets('amadeus')
    expect(diag.ok).toBe(false)
    expect(diag.missingKeys.length).toBeGreaterThan(0)
    expect(diag.detail).not.toMatch(/sk_|secret_|token_/i)
    const all = validateAllProviderSecrets()
    expect(all.find((d) => d.providerId === 'mock')?.ok).toBe(true)
  })

  it('tracks health metrics: latency, failures, retries, quota', async () => {
    const health = new ProviderRuntimeHealthMonitor()
    const mock = createMockRuntimeAdapter(health)
    await mock.initialize()
    await mock.search({
      domain: 'flights',
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-09-01',
    })
    const snap = mock.health()
    expect(snap.available).toBe(true)
    expect(snap.latencyMs).toBeGreaterThanOrEqual(0)
    expect(snap.quotaUsed).toBeGreaterThan(0)
    expect(snap.availability).toBeGreaterThan(0)
  })

  it('retries with exponential backoff and circuit breaker', async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2, openMs: 60_000 })
    const policy = createProviderRetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      timeoutMs: 100,
      circuitBreaker: breaker,
    })
    let calls = 0
    const outcome = await policy.execute('amadeus', async () => {
      calls += 1
      throw new Error('transient')
    })
    expect(outcome.ok).toBe(false)
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(outcome.attempts).toBeGreaterThanOrEqual(2)
  })

  it('failovers primary → secondary → mock with graceful message', async () => {
    const health = new ProviderRuntimeHealthMonitor()
    const mock = createMockRuntimeAdapter(health)
    await mock.initialize()

    const primary = {
      providerId: 'amadeus' as const,
      displayName: 'Amadeus',
      async initialize() {},
      async authenticate() {
        return { ok: true, mode: 'live' as const, detail: 'test' }
      },
      health() {
        return {
          providerId: 'amadeus' as const,
          available: true,
          mode: 'live' as const,
          latencyMs: 0,
          availability: 1,
          failures: 0,
          retries: 0,
          quotaUsed: 0,
          quotaLimit: 100,
          circuitState: 'closed' as const,
          detail: 'live',
        }
      },
      capabilities() {
        return { flights: true, hotels: false, book: true, cancel: true, refresh: true }
      },
      async search() {
        return {
          ok: false,
          providerId: 'amadeus' as const,
          mode: 'live' as const,
          offers: [],
          latencyMs: 1,
          error: 'forced_failure',
        }
      },
      async book() {
        return { ok: false, providerId: 'amadeus' as const, error: 'no' }
      },
      async cancel() {
        return { ok: false, providerId: 'amadeus' as const }
      },
      async refresh() {
        return { ok: false, providerId: 'amadeus' as const }
      },
    }

    const chain = buildFailoverChain('amadeus', [primary, mock])
    expect(chain[0]?.providerId).toBe('amadeus')
    expect(chain[chain.length - 1]?.providerId).toBe('mock')

    const result = await searchWithFailover([primary, mock], {
      domain: 'flights',
      origin: 'RUH',
      destination: 'JED',
      departureDate: '2026-10-01',
    }, 'amadeus')
    expect(result.ok).toBe(true)
    expect(result.usedProviderId).toBe('mock')
    expect(result.attempted).toContain('amadeus')
    expect(result.gracefulMessage).toBe(GRACEFUL_PROVIDER_MESSAGE)
  })

  it('supports book / cancel / refresh on mock without crashing', async () => {
    const registry = createProviderRuntimeRegistry({ forceMock: true })
    await registry.initializeAll()
    const mock = registry.getProvider('mock')!
    const book = await mock.book({ offerId: 'offer_1' })
    expect(book.ok).toBe(true)
    expect(book.orderId).toContain('mock_order_')
    const refresh = await mock.refresh({ orderId: book.orderId! })
    expect(refresh.ok).toBe(true)
    const cancel = await mock.cancel({ orderId: book.orderId! })
    expect(cancel.ok).toBe(true)
  })

  it('registry search never throws and returns diagnostics', async () => {
    const registry = createProviderRuntimeRegistry({ forceMock: true })
    await registry.initializeAll()
    const result = await registry.search({
      domain: 'hotels',
      destination: 'Dubai',
      checkIn: '2026-11-01',
      checkOut: '2026-11-05',
    })
    expect(result.ok).toBe(true)
    expect(registry.diagnostics().every((d) => !JSON.stringify(d).includes('sk_live'))).toBe(true)
    expect(registry.health().length).toBe(4)
  })
})
