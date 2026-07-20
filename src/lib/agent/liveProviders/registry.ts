/**
 * Live Provider Layer registry / runtime — Sprint 56.
 */

import { createAmadeusLiveProvider } from './adapters/amadeus'
import { createBookingLiveProvider } from './adapters/booking'
import { createDuffelLiveProvider } from './adapters/duffel'
import { bridgeLiveProviderToBooking } from './bridge'
import { SmartCache } from './cache'
import {
  hasAmadeusCredentials,
  hasBookingCredentials,
  hasDuffelCredentials,
  isLiveProviderEnabled,
  isLiveProvidersEnabled,
} from './feature'
import { ProviderHealthMonitor } from './health'
import { LiveProviderMetrics } from './metrics'
import { ProviderRateLimiterRegistry } from './rateLimiter'
import { selectLiveProviders, withProviderFailover } from './selection'
import { snapshotLiveProviderSecrets } from './secrets'
import type {
  LiveFetch,
  LiveFlightSearchInput,
  LiveHotelSearchInput,
  LiveProviderHealth,
  LiveProviderId,
  LiveProviderMetricsSnapshot,
  LiveProviderSdk,
  LiveSearchDomain,
} from './types'
import { wrapLiveProvider } from './wrap'
import type { BookingProvider } from '../bookingIntelligence/types'

export type LiveProviderRuntimeOptions = {
  enabled?: boolean
  fetchImpl?: LiveFetch
  providers?: LiveProviderSdk[]
  includeSimulatedFallback?: boolean
  rateLimit?: { maxRequests: number; windowMs: number }
  now?: () => number
}

export type LiveProviderRuntime = {
  isEnabled(): boolean
  list(): LiveProviderSdk[]
  get(providerId: LiveProviderId): LiveProviderSdk | undefined
  health(): LiveProviderHealth[]
  metrics(): LiveProviderMetricsSnapshot
  cacheStats(): ReturnType<SmartCache['stats']>
  rateLimitStats(): ReturnType<ProviderRateLimiterRegistry['stats']>
  secrets(): ReturnType<typeof snapshotLiveProviderSecrets>
  select(domain: LiveSearchDomain, limit?: number): LiveProviderSdk[]
  searchFlights(input: LiveFlightSearchInput): Promise<{
    offers: Awaited<ReturnType<NonNullable<LiveProviderSdk['searchFlights']>>>
    usedProviderId: LiveProviderId | null
    attempted: LiveProviderId[]
  }>
  searchHotels(input: LiveHotelSearchInput): Promise<{
    offers: Awaited<ReturnType<NonNullable<LiveProviderSdk['searchHotels']>>>
    usedProviderId: LiveProviderId | null
    attempted: LiveProviderId[]
  }>
  toBookingProviders(): BookingProvider[]
}

export function createLiveProviderRuntime(
  options: LiveProviderRuntimeOptions = {},
): LiveProviderRuntime {
  const enabled = isLiveProvidersEnabled({ enabled: options.enabled })
  const health = new ProviderHealthMonitor({ now: options.now })
  const metrics = new LiveProviderMetrics()
  const cache = new SmartCache({ now: options.now })
  const rateLimits = new ProviderRateLimiterRegistry(
    options.rateLimit ?? { maxRequests: 30, windowMs: 60_000, maxQueue: 40 },
  )

  const rawProviders: LiveProviderSdk[] = options.providers
    ? [...options.providers]
    : buildDefaultProviders(options.fetchImpl)

  const providers = rawProviders.map((sdk) =>
    wrapLiveProvider({
      sdk,
      health,
      rateLimiter: rateLimits.get(sdk.providerId),
      cache,
      metrics,
      now: options.now,
    }),
  )

  return {
    isEnabled: () => enabled,
    list: () => providers.slice(),
    get(providerId) {
      return providers.find((p) => p.providerId === providerId)
    },
    health: () => health.snapshots(providers.map((p) => p.providerId)),
    metrics: () => metrics.snapshot(),
    cacheStats: () => cache.stats(),
    rateLimitStats: () => rateLimits.stats(),
    secrets: () => snapshotLiveProviderSecrets(),
    select(domain, limit) {
      if (!enabled) return []
      return selectLiveProviders({
        providers,
        health,
        criteria: { domain },
        limit,
      }).selected
    },
    async searchFlights(input) {
      const selected = this.select('flights')
      const failover = await withProviderFailover({
        providers: selected,
        run: async (sdk) => (await sdk.searchFlights?.(input)) ?? [],
        isEmpty: (offers) => offers.length === 0,
      })
      return {
        offers: failover.result ?? [],
        usedProviderId: failover.usedProviderId,
        attempted: failover.attempted,
      }
    },
    async searchHotels(input) {
      const selected = this.select('hotels')
      const failover = await withProviderFailover({
        providers: selected,
        run: async (sdk) => (await sdk.searchHotels?.(input)) ?? [],
        isEmpty: (offers) => offers.length === 0,
      })
      return {
        offers: failover.result ?? [],
        usedProviderId: failover.usedProviderId,
        attempted: failover.attempted,
      }
    },
    toBookingProviders() {
      if (!enabled) return []
      return providers.flatMap((sdk) => bridgeLiveProviderToBooking(sdk))
    },
  }
}

function buildDefaultProviders(fetchImpl?: LiveFetch): LiveProviderSdk[] {
  if (!isLiveProvidersEnabled()) return []
  const out: LiveProviderSdk[] = []

  if (isLiveProviderEnabled('amadeus')) {
    out.push(
      createAmadeusLiveProvider({
        fetchImpl,
        available: hasAmadeusCredentials() ? undefined : false,
      }),
    )
  }
  if (isLiveProviderEnabled('duffel')) {
    out.push(
      createDuffelLiveProvider({
        fetchImpl,
        available: hasDuffelCredentials() ? undefined : false,
      }),
    )
  }
  if (isLiveProviderEnabled('booking')) {
    out.push(
      createBookingLiveProvider({
        fetchImpl,
        available: hasBookingCredentials() ? undefined : false,
      }),
    )
  }

  return out
}

/** Factory used by Booking Intelligence default registry composition. */
export function createLiveBookingProviders(
  options: LiveProviderRuntimeOptions = {},
): BookingProvider[] {
  if (!isLiveProvidersEnabled({ enabled: options.enabled })) return []
  return createLiveProviderRuntime(options).toBookingProviders()
}
