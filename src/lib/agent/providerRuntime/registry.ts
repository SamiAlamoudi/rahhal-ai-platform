/**
 * Sprint 71 — Provider Runtime Registry.
 */

import { createCircuitBreaker } from '../aggregation/liveIntegration/circuitBreaker'
import type { LiveFetch } from '../liveProviders/types'
import {
  createAmadeusRuntimeAdapter,
  createBookingComRuntimeAdapter,
  createDuffelRuntimeAdapter,
  createMockRuntimeAdapter,
} from './adapters'
import { searchWithFailover } from './failover'
import { ProviderRuntimeHealthMonitor } from './healthMonitor'
import { createProviderRetryPolicy } from './retryPolicy'
import { validateAllProviderSecrets } from './secretsDiagnostics'
import type {
  ProviderRuntimeAdapter,
  ProviderRuntimeHealth,
  ProviderRuntimeId,
  ProviderRuntimeSearchRequest,
  ProviderSecretDiagnostic,
} from './types'
import { SPRINT71_PROVIDER_RUNTIME_VERSION } from './types'

export type ProviderRuntimeRegistryOptions = {
  fetchImpl?: LiveFetch
  forceMock?: boolean
  preferredOrder?: ProviderRuntimeId[]
}

export type ProviderRuntimeRegistry = {
  version: string
  initializeAll(): Promise<void>
  getProvider(id: ProviderRuntimeId): ProviderRuntimeAdapter | undefined
  getAvailableProviders(): ProviderRuntimeAdapter[]
  getHealthyProviders(): ProviderRuntimeAdapter[]
  getPreferredProvider(domain?: 'flights' | 'hotels'): ProviderRuntimeAdapter
  list(): ProviderRuntimeAdapter[]
  health(): ProviderRuntimeHealth[]
  diagnostics(): ProviderSecretDiagnostic[]
  search(request: ProviderRuntimeSearchRequest): ReturnType<typeof searchWithFailover>
}

export function createProviderRuntimeRegistry(
  options: ProviderRuntimeRegistryOptions = {},
): ProviderRuntimeRegistry {
  const breaker = createCircuitBreaker({ failureThreshold: 3, openMs: 5_000 })
  const healthMonitor = new ProviderRuntimeHealthMonitor(breaker)
  const retry = createProviderRetryPolicy({ circuitBreaker: breaker })

  const shared = {
    fetchImpl: options.fetchImpl,
    healthMonitor,
    retry,
    forceMock: options.forceMock,
  }

  const adapters: ProviderRuntimeAdapter[] = [
    createAmadeusRuntimeAdapter(shared),
    createDuffelRuntimeAdapter(shared),
    createBookingComRuntimeAdapter(shared),
    createMockRuntimeAdapter(healthMonitor, retry),
  ]

  const byId = new Map(adapters.map((a) => [a.providerId, a]))

  const preferredOrder = options.preferredOrder ?? [
    'amadeus',
    'duffel',
    'booking',
    'mock',
  ]

  return {
    version: SPRINT71_PROVIDER_RUNTIME_VERSION,

    async initializeAll() {
      await Promise.all(adapters.map((a) => a.initialize()))
    },

    getProvider(id) {
      return byId.get(id)
    },

    getAvailableProviders() {
      return adapters.filter((a) => {
        const h = a.health()
        return h.available || a.providerId === 'mock'
      })
    },

    getHealthyProviders() {
      return adapters.filter((a) => {
        const h = a.health()
        return (h.available && h.circuitState !== 'open') || a.providerId === 'mock'
      })
    },

    getPreferredProvider(domain = 'flights') {
      for (const id of preferredOrder) {
        const a = byId.get(id)
        if (!a) continue
        const caps = a.capabilities()
        if (domain === 'hotels' && !caps.hotels && id !== 'mock') continue
        if (domain === 'flights' && !caps.flights && id !== 'mock' && id !== 'booking') continue
        const h = a.health()
        if (h.mode === 'live' && h.circuitState !== 'open') return a
      }
      // Prefer domain-aligned mock-mode live wrappers, else mock
      if (domain === 'hotels') {
        const booking = byId.get('booking')
        if (booking) return booking
      }
      const amadeus = byId.get('amadeus')
      if (amadeus && domain === 'flights') return amadeus
      return byId.get('mock')!
    },

    list() {
      return [...adapters]
    },

    health() {
      return adapters.map((a) => a.health())
    },

    diagnostics() {
      return validateAllProviderSecrets()
    },

    search(request) {
      const preferred = this.getPreferredProvider(
        request.domain === 'hotels' ? 'hotels' : 'flights',
      )
      return searchWithFailover(adapters, request, preferred.providerId)
    },
  }
}

let defaultRegistry: ProviderRuntimeRegistry | null = null

export function getDefaultProviderRuntimeRegistry(
  options?: ProviderRuntimeRegistryOptions,
): ProviderRuntimeRegistry {
  if (!defaultRegistry || options) {
    defaultRegistry = createProviderRuntimeRegistry(options)
  }
  return defaultRegistry
}

export function resetDefaultProviderRuntimeRegistry(): void {
  defaultRegistry = null
}
