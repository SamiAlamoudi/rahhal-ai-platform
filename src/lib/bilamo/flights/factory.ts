/**
 * Resolve demo vs live FlightSearchProvider.
 */

import { flightSearchCacheKey, getCachedFlightSearch, setCachedFlightSearch } from './cache'
import { createDemoFlightSearchProvider } from './demoProvider'
import { resolveBilamoFlightMode } from './feature'
import { createLiveFlightSearchProvider, type LiveFlightProviderOptions } from './liveProvider'
import type { FlightSearchProvider } from './provider'
import type { BilamoFlightSearchRequest, FlightProviderMode, FlightSearchProviderResult } from './types'

export type CreateBilamoFlightProviderOptions = LiveFlightProviderOptions & {
  mode?: FlightProviderMode
  cache?: boolean
}

function withCache(inner: FlightSearchProvider): FlightSearchProvider {
  return {
    providerId: inner.providerId,
    async searchFlights(request: BilamoFlightSearchRequest): Promise<FlightSearchProviderResult> {
      const key = flightSearchCacheKey(request)
      const hit = getCachedFlightSearch(key)
      if (hit?.ok) return hit
      const result = await inner.searchFlights(request)
      if (result.ok) setCachedFlightSearch(key, result)
      return result
    },
    getOfferDetails: (id) => inner.getOfferDetails(id),
    healthCheck: () => inner.healthCheck(),
  }
}

export function createBilamoFlightSearchProvider(
  options: CreateBilamoFlightProviderOptions = {},
): FlightSearchProvider {
  const mode = options.mode ?? resolveBilamoFlightMode()
  const base = mode === 'live'
    ? createLiveFlightSearchProvider(options)
    : createDemoFlightSearchProvider()
  return options.cache === false ? base : withCache(base)
}
