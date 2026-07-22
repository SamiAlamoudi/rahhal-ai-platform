/**
 * Sprint 104 — Live Provider Gateway tests (Production Phase 1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  SPRINT104_PROVIDER_GATEWAY_VERSION,
  createProviderGateway,
  createGatewayProviderRegistry,
  createProviderHealthMonitor,
  createGatewayMetrics,
  checkRegistryAvailability,
  detectProviderAvailability,
  buildProviderRequest,
  buildGatewayFlightRequest,
  mapProviderSearchResult,
  translateProviderError,
  PHASE1_DESCRIPTORS,
  createMockTravelProvider,
  type GatewayRequest,
  type TravelProvider,
} from '../../core'
import {
  isLiveProviderGatewayEnabled,
  LIVE_PROVIDER_GATEWAY_FEATURE_ID,
  runLiveProviderGateway,
  createLiveProviderGateway,
} from '../agent/providerGateway'

function flightRequest(overrides?: Partial<GatewayRequest>): GatewayRequest {
  return {
    operation: 'search_flights',
    providerId: 'amadeus',
    flight: {
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-08-15',
      adults: 1,
      currency: 'SAR',
    },
    ...overrides,
  }
}

function gatewayWithMock(provider: TravelProvider) {
  const registry = createGatewayProviderRegistry({ enableAmadeus: false })
  registry.register('amadeus', provider, { enabled: true })
  return createProviderGateway({
    registry,
    sleep: async () => undefined,
    timeoutMs: 2_000,
    maxAttempts: 3,
  })
}

describe('Sprint 104 — Live Provider Gateway', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT104_PROVIDER_GATEWAY_VERSION).toMatch(/live-provider-gateway/)
    expect(LIVE_PROVIDER_GATEWAY_FEATURE_ID).toBe('ai.live_provider_gateway')
    expect(getFeatureRegistry().isEnabled('ai.live_provider_gateway')).toBe(false)
    expect(isLiveProviderGatewayEnabled()).toBe(false)
  })

  it('Phase 1 enables only Amadeus in descriptors', () => {
    const enabled = PHASE1_DESCRIPTORS.filter((d) => d.phase1Enabled)
    expect(enabled).toHaveLength(1)
    expect(enabled[0]?.id).toBe('amadeus')
    expect(PHASE1_DESCRIPTORS.some((d) => d.id === 'duffel' && !d.phase1Enabled)).toBe(true)
    expect(PHASE1_DESCRIPTORS.some((d) => d.id === 'booking_com' && !d.phase1Enabled)).toBe(true)
  })

  describe('registry + availability', () => {
    it('registers Amadeus enabled by default; Duffel unavailable in Phase 1', () => {
      const registry = createGatewayProviderRegistry()
      expect(checkRegistryAvailability(registry, 'amadeus').available).toBe(true)
      expect(checkRegistryAvailability(registry, 'duffel').available).toBe(false)
      expect(checkRegistryAvailability(registry, 'booking_com').available).toBe(false)
      expect(registry.resolve('amadeus')?.enabled).toBe(true)
      expect(registry.resolve('duffel')).toBeNull()
    })

    it('detectProviderAvailability prefers healthy Amadeus', async () => {
      const registry = createGatewayProviderRegistry()
      const mock = createMockTravelProvider({ id: 'amadeus', mode: 'sandbox' })
      registry.register('amadeus', mock, { enabled: true })
      const monitor = createProviderHealthMonitor(registry)
      const report = await detectProviderAvailability(monitor)
      expect(report.preferred).toBe('amadeus')
      expect(report.providers.find((p) => p.id === 'amadeus')?.available).toBe(true)
    })
  })

  describe('request builder + response mapper', () => {
    it('builds flight requests and maps offers', () => {
      const built = buildGatewayFlightRequest(flightRequest())
      expect(built?.origin).toBe('RUH')
      expect(built?.destination).toBe('DXB')

      const providerReq = buildProviderRequest(flightRequest())
      expect(providerReq?.kind).toBe('flights')

      const offers = mapProviderSearchResult('amadeus', 'flight', {
        ok: true,
        providerId: 'amadeus',
        mode: 'sandbox',
        results: [{ id: 'o1', title: 'SV RUH→DXB', price: 900, currency: 'sar' }],
        partial: false,
        empty: false,
        latencyMs: 12,
      })
      expect(offers).toHaveLength(1)
      expect(offers[0]?.price).toBe(900)
      expect(offers[0]?.currency).toBe('SAR')
    })

    it('rejects incomplete flight criteria', () => {
      expect(
        buildProviderRequest({
          operation: 'search_flights',
          flight: { origin: '', destination: 'DXB', departureDate: '2026-08-15' },
        }),
      ).toBeNull()
    })
  })

  describe('error translation + metrics', () => {
    it('translates rate-limit and timeout codes', () => {
      const rate = translateProviderError('amadeus', new Error('429 Too Many Requests'), 429)
      expect(rate.rateLimited).toBe(true)
      expect(rate.retryable).toBe(true)

      const timeout = translateProviderError('amadeus', new Error('timeout'))
      expect(timeout.timedOut || timeout.code === 'TIMEOUT' || timeout.retryable).toBe(true)
    })

    it('records gateway metrics snapshots', () => {
      const metrics = createGatewayMetrics()
      metrics.record({
        providerId: 'amadeus',
        operation: 'search_flights',
        ok: true,
        latencyMs: 42,
      })
      const snap = metrics.snapshot('amadeus', 'search_flights')
      expect(snap.requests).toBeGreaterThanOrEqual(1)
      expect(snap.successes).toBeGreaterThanOrEqual(1)
    })
  })

  describe('ProviderGateway execute', () => {
    it('searches flights via registered mock Amadeus', async () => {
      const mock = createMockTravelProvider({
        id: 'amadeus',
        mode: 'sandbox',
        latencyMs: 0,
      })
      const gateway = gatewayWithMock(mock)
      const response = await gateway.execute(flightRequest())
      expect(response.enabled).toBe(true)
      expect(response.ok).toBe(true)
      expect(response.providerId).toBe('amadeus')
      expect(response.offers.length).toBeGreaterThan(0)
      expect(response.attempts).toBeGreaterThanOrEqual(1)
      expect(gateway.getStructuredLogs().some((l) => l.message === 'gateway.execute.ok')).toBe(true)
    })

    it('returns unavailable for Duffel in Phase 1', async () => {
      const gateway = createProviderGateway({
        sleep: async () => undefined,
      })
      const response = await gateway.execute({
        operation: 'search_flights',
        providerId: 'duffel',
        flight: {
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-08-15',
        },
      })
      expect(response.ok).toBe(false)
      expect(response.error?.message).toMatch(/Phase 1|disabled/i)
    })

    it('retries then succeeds when flights throw once', async () => {
      let calls = 0
      const base = createMockTravelProvider({ id: 'amadeus', mode: 'sandbox', latencyMs: 0 })
      const flaky: TravelProvider = {
        ...base,
        async searchFlights(request) {
          calls += 1
          if (calls === 1) {
            throw new Error('network failure')
          }
          return base.searchFlights(request)
        },
      }
      const gateway = gatewayWithMock(flaky)
      const response = await gateway.execute(flightRequest())
      expect(response.ok).toBe(true)
      expect(calls).toBeGreaterThanOrEqual(2)
      expect(response.attempts).toBeGreaterThanOrEqual(2)
    })

    it('handles timeout via retry policy', async () => {
      const base = createMockTravelProvider({ id: 'amadeus', mode: 'sandbox' })
      const slow: TravelProvider = {
        ...base,
        async searchFlights() {
          await new Promise((r) => setTimeout(r, 50))
          throw new Error('should have aborted')
        },
      }
      const gateway = createProviderGateway({
        registry: (() => {
          const registry = createGatewayProviderRegistry({ enableAmadeus: false })
          registry.register('amadeus', slow, { enabled: true })
          return registry
        })(),
        sleep: async () => undefined,
        timeoutMs: 5,
        maxAttempts: 2,
      })
      const response = await gateway.execute(flightRequest({ timeoutMs: 5 }))
      expect(response.ok).toBe(false)
      expect(response.error).not.toBeNull()
    })

    it('runs health check through gateway', async () => {
      const mock = createMockTravelProvider({ id: 'amadeus', mode: 'sandbox', latencyMs: 0 })
      const gateway = gatewayWithMock(mock)
      const response = await gateway.execute({
        operation: 'health',
        providerId: 'amadeus',
      })
      expect(response.ok).toBe(true)
      expect(response.operation).toBe('health')
    })
  })

  describe('feature flag compatibility', () => {
    it('flag OFF: runLiveProviderGateway does not call providers', async () => {
      const searchFlights = vi.fn()
      const base = createMockTravelProvider({ id: 'amadeus', mode: 'sandbox' })
      const spy: TravelProvider = {
        ...base,
        searchFlights: searchFlights.mockImplementation(base.searchFlights.bind(base)),
      }
      const registry = createGatewayProviderRegistry({ enableAmadeus: false })
      registry.register('amadeus', spy, { enabled: true })
      const gateway = createProviderGateway({ registry, sleep: async () => undefined })

      expect(getFeatureRegistry().isEnabled('ai.live_provider_gateway')).toBe(false)
      const response = await runLiveProviderGateway(flightRequest(), { gateway })
      expect(response.enabled).toBe(false)
      expect(response.ok).toBe(false)
      expect(response.logs).toContain('live_provider_gateway_disabled')
      expect(searchFlights).not.toHaveBeenCalled()
      expect(createLiveProviderGateway()).toBeNull()
    })

    it('flag ON: runLiveProviderGateway delegates to gateway', async () => {
      getFeatureRegistry().setEnabled('ai.live_provider_gateway', true)
      expect(isLiveProviderGatewayEnabled()).toBe(true)

      const mock = createMockTravelProvider({ id: 'amadeus', mode: 'sandbox', latencyMs: 0 })
      const registry = createGatewayProviderRegistry({ enableAmadeus: false })
      registry.register('amadeus', mock, { enabled: true })
      const gateway = createProviderGateway({ registry, sleep: async () => undefined })

      const response = await runLiveProviderGateway(flightRequest(), {
        enabled: true,
        gateway,
      })
      expect(response.enabled).toBe(true)
      expect(response.ok).toBe(true)
      expect(response.offers.length).toBeGreaterThan(0)
      expect(createLiveProviderGateway({ enabled: true })).not.toBeNull()
    })
  })
})
