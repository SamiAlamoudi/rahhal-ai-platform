/**
 * Sprint 90 — provider registry (mock / sandbox / live ready).
 */

import { assertProviderSurface } from './ProviderCapabilities'
import { probeAllProviders, summarizeHealth } from './ProviderHealth'
import { createProviderMetricsStore, type ProviderMetricsStore } from './ProviderMetrics'
import {
  createProviderCircuitBreaker,
  type ProviderCircuitBreaker,
} from './ProviderCircuitBreaker'
import {
  executeWithFailover,
  sortProvidersByPriority,
  type PrioritizedProvider,
  type FailoverResult,
} from './ProviderPriority'
import { createMockTravelProvider } from './mocks'
import {
  SPRINT90_PROVIDER_READINESS_VERSION,
  type FlightSearchRequest,
  type HotelSearchRequest,
  type ProviderMode,
  type ProviderSearchResult,
  type TravelProvider,
} from './types'

export interface ProviderRegistryOptions {
  metrics?: ProviderMetricsStore
  circuitBreaker?: ProviderCircuitBreaker
}

export interface ProviderRegistrySnapshot {
  version: string
  providers: Array<{
    id: string
    displayName: string
    mode: ProviderMode
    surfaceOk: boolean
    missingSurface: string[]
  }>
  healthSummary: ReturnType<typeof summarizeHealth> | null
}

export interface ProviderRegistry {
  register(
    provider: TravelProvider,
    priority?: { tier: PrioritizedProvider['tier']; rank?: number },
  ): void
  unregister(providerId: string): void
  get(providerId: string): TravelProvider | null
  list(): TravelProvider[]
  listPrioritized(): PrioritizedProvider[]
  metrics: ProviderMetricsStore
  circuitBreaker: ProviderCircuitBreaker
  healthCheckAll(): Promise<ProviderRegistrySnapshot>
  searchFlightsWithFailover(
    request: FlightSearchRequest,
  ): Promise<FailoverResult<ProviderSearchResult>>
  searchHotelsWithFailover(
    request: HotelSearchRequest,
  ): Promise<FailoverResult<ProviderSearchResult>>
  ensureDefaultMock(): TravelProvider
}

export function createProviderRegistry(
  options: ProviderRegistryOptions = {},
): ProviderRegistry {
  const providers = new Map<string, TravelProvider>()
  const priorities = new Map<string, { tier: PrioritizedProvider['tier']; rank: number }>()
  const metrics = options.metrics ?? createProviderMetricsStore()
  const circuitBreaker = options.circuitBreaker ?? createProviderCircuitBreaker()

  const listPrioritized = (): PrioritizedProvider[] => {
    const entries: PrioritizedProvider[] = []
    for (const provider of providers.values()) {
      const p = priorities.get(provider.id) ?? { tier: 'fallback' as const, rank: 100 }
      entries.push({ provider, tier: p.tier, rank: p.rank })
    }
    return sortProvidersByPriority(entries)
  }

  const registry: ProviderRegistry = {
    metrics,
    circuitBreaker,
    register(provider, priority) {
      const missing = assertProviderSurface(provider)
      if (missing.length) {
        throw new Error(`Provider ${provider.id} missing surface: ${missing.join(', ')}`)
      }
      providers.set(provider.id, provider)
      priorities.set(provider.id, {
        tier: priority?.tier ?? 'secondary',
        rank: priority?.rank ?? 50,
      })
    },
    unregister(providerId) {
      providers.delete(providerId)
      priorities.delete(providerId)
    },
    get(providerId) {
      return providers.get(providerId) ?? null
    },
    list() {
      return Array.from(providers.values())
    },
    listPrioritized,
    async healthCheckAll() {
      const list = Array.from(providers.values())
      const health = await probeAllProviders(list)
      return {
        version: SPRINT90_PROVIDER_READINESS_VERSION,
        providers: list.map((p) => {
          const missingSurface = assertProviderSurface(p)
          return {
            id: p.id,
            displayName: p.displayName,
            mode: p.mode,
            surfaceOk: missingSurface.length === 0,
            missingSurface,
          }
        }),
        healthSummary: summarizeHealth(health),
      }
    },
    async searchFlightsWithFailover(request) {
      return executeWithFailover(listPrioritized(), async (provider) => {
        if (!circuitBreaker.allow(provider.id)) {
          throw new Error('circuit_open')
        }
        const started = performance.now()
        try {
          const result = await provider.searchFlights(request)
          const latency = Math.round(performance.now() - started)
          if (result.ok) {
            metrics.recordSuccess(provider.id, latency)
            circuitBreaker.recordSuccess(provider.id)
          } else {
            metrics.recordFailure(provider.id, latency, result.error)
            circuitBreaker.recordFailure(provider.id)
            throw new Error(result.error ?? 'search_failed')
          }
          return result
        } catch (err) {
          const latency = Math.round(performance.now() - started)
          metrics.recordFailure(
            provider.id,
            latency,
            err instanceof Error ? err.message : String(err),
          )
          circuitBreaker.recordFailure(provider.id)
          throw err
        }
      })
    },
    async searchHotelsWithFailover(request) {
      return executeWithFailover(listPrioritized(), async (provider) => {
        if (!circuitBreaker.allow(provider.id)) {
          throw new Error('circuit_open')
        }
        const started = performance.now()
        try {
          const result = await provider.searchHotels(request)
          const latency = Math.round(performance.now() - started)
          if (result.ok) {
            metrics.recordSuccess(provider.id, latency)
            circuitBreaker.recordSuccess(provider.id)
          } else {
            metrics.recordFailure(provider.id, latency, result.error)
            circuitBreaker.recordFailure(provider.id)
            throw new Error(result.error ?? 'search_failed')
          }
          return result
        } catch (err) {
          const latency = Math.round(performance.now() - started)
          metrics.recordFailure(
            provider.id,
            latency,
            err instanceof Error ? err.message : String(err),
          )
          circuitBreaker.recordFailure(provider.id)
          throw err
        }
      })
    },
    ensureDefaultMock() {
      const existing = providers.get('mock')
      if (existing) return existing
      const mock = createMockTravelProvider()
      registry.register(mock, { tier: 'fallback', rank: 100 })
      return mock
    },
  }

  return registry
}
