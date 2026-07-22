/**
 * Sprint 90 — provider capability + limit helpers.
 */

import type { ProviderCapabilityMap, ProviderLimits, TravelProvider } from './types'

export const DEFAULT_PROVIDER_LIMITS: ProviderLimits = {
  maxRequestsPerMinute: 60,
  maxConcurrent: 4,
  timeoutMs: 8_000,
  maxRetries: 3,
}

export function emptyCapabilities(): ProviderCapabilityMap {
  return {
    flights: false,
    hotels: false,
    packages: false,
    booking: false,
    cancellation: false,
    sandbox: false,
    live: false,
  }
}

export function mergeCapabilities(
  ...maps: ProviderCapabilityMap[]
): ProviderCapabilityMap {
  return maps.reduce<ProviderCapabilityMap>(
    (acc, m) => ({
      flights: acc.flights || m.flights,
      hotels: acc.hotels || m.hotels,
      packages: acc.packages || m.packages,
      booking: acc.booking || m.booking,
      cancellation: acc.cancellation || m.cancellation,
      sandbox: acc.sandbox || m.sandbox,
      live: acc.live || m.live,
    }),
    emptyCapabilities(),
  )
}

export function assertProviderSurface(provider: TravelProvider): string[] {
  const missing: string[] = []
  const required = [
    'health',
    'searchFlights',
    'searchHotels',
    'searchPackages',
    'capabilities',
    'limits',
  ] as const
  for (const key of required) {
    if (typeof provider[key] !== 'function') missing.push(key)
  }
  return missing
}

export function describeCapabilities(map: ProviderCapabilityMap): string[] {
  return (Object.keys(map) as Array<keyof ProviderCapabilityMap>)
    .filter((k) => map[k])
    .map(String)
}
