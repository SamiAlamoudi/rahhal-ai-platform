/**
 * Instrumented LiveProviderSdk wrapper — health, rate limit, cache, metrics.
 */

import type { SmartCache } from './cache'
import type { ProviderHealthMonitor } from './health'
import type { LiveProviderMetrics } from './metrics'
import type { ProviderRateLimiter } from './rateLimiter'
import type {
  LiveActivityOffer,
  LiveCarOffer,
  LiveFetch,
  LiveFlightOffer,
  LiveFlightSearchInput,
  LiveGenericSearchInput,
  LiveHotelOffer,
  LiveHotelSearchInput,
  LiveInsuranceOffer,
  LiveProviderSdk,
  LiveTransferOffer,
} from './types'

export type WrapLiveProviderOptions = {
  sdk: LiveProviderSdk
  health: ProviderHealthMonitor
  rateLimiter: ProviderRateLimiter
  cache: SmartCache
  metrics: LiveProviderMetrics
  now?: () => number
}

function cacheKey(parts: unknown[]): string {
  return JSON.stringify(parts)
}

function qualityFromCount(count: number): number {
  if (count <= 0) return 0.2
  if (count >= 10) return 0.95
  return 0.4 + count * 0.05
}

export function wrapLiveProvider(options: WrapLiveProviderOptions): LiveProviderSdk {
  const { sdk, health, rateLimiter, cache, metrics } = options
  const now = options.now ?? (() => Date.now())

  async function timed<T>(
    label: string,
    cacheNamespace: Parameters<SmartCache['get']>[0] | null,
    key: string | null,
    fn: () => Promise<T>,
    qualityOf: (result: T) => number,
  ): Promise<T> {
    if (cacheNamespace && key) {
      const hit = cache.get<T>(cacheNamespace, key)
      if (hit !== undefined) {
        metrics.recordCache(true)
        return hit
      }
      metrics.recordCache(false)
    }

    const started = now()
    try {
      const result = await rateLimiter.run(fn)
      const latency = now() - started
      metrics.recordApiCall(sdk.providerId, latency, true)
      health.recordSuccess(sdk.providerId, latency, qualityOf(result))
      if (cacheNamespace && key) cache.set(cacheNamespace, key, result)
      void label
      return result
    } catch (err) {
      const latency = now() - started
      metrics.recordApiCall(sdk.providerId, latency, false)
      health.recordFailure(
        sdk.providerId,
        latency,
        err instanceof Error ? err.message : 'error',
      )
      throw err
    }
  }

  const wrapped: LiveProviderSdk = {
    providerId: sdk.providerId,
    displayName: sdk.displayName,
    capabilities: sdk.capabilities,
    isAvailable() {
      return sdk.isAvailable() && health.isAvailable(sdk.providerId)
    },
  }

  if (sdk.searchFlights) {
    wrapped.searchFlights = async (input: LiveFlightSearchInput): Promise<LiveFlightOffer[]> => {
      const searchStarted = now()
      const key = cacheKey([
        'flights',
        input.origin,
        input.destination,
        input.departureDate,
        input.returnDate,
        input.adults,
        input.currency,
      ])
      const result = await timed(
        'searchFlights',
        'flight_routes',
        key,
        () => sdk.searchFlights!(input),
        (offers) => qualityFromCount(offers.length),
      )
      metrics.recordSearchDuration(now() - searchStarted)
      return result
    }
  }

  if (sdk.searchHotels) {
    wrapped.searchHotels = async (input: LiveHotelSearchInput): Promise<LiveHotelOffer[]> => {
      const searchStarted = now()
      const key = cacheKey([
        'hotels',
        input.destination,
        input.checkIn,
        input.checkOut,
        input.adults,
        input.currency,
      ])
      const result = await timed(
        'searchHotels',
        'hotels',
        key,
        () => sdk.searchHotels!(input),
        (offers) => qualityFromCount(offers.length),
      )
      metrics.recordSearchDuration(now() - searchStarted)
      return result
    }
  }

  if (sdk.searchActivities) {
    wrapped.searchActivities = async (
      input: LiveGenericSearchInput,
    ): Promise<LiveActivityOffer[]> =>
      timed(
        'searchActivities',
        'generic',
        cacheKey(['activities', input]),
        () => sdk.searchActivities!(input),
        (offers) => qualityFromCount(offers.length),
      )
  }

  if (sdk.searchCars) {
    wrapped.searchCars = async (input: LiveGenericSearchInput): Promise<LiveCarOffer[]> =>
      timed(
        'searchCars',
        'generic',
        cacheKey(['cars', input]),
        () => sdk.searchCars!(input),
        (offers) => qualityFromCount(offers.length),
      )
  }

  if (sdk.searchTransfers) {
    wrapped.searchTransfers = async (
      input: LiveGenericSearchInput,
    ): Promise<LiveTransferOffer[]> =>
      timed(
        'searchTransfers',
        'generic',
        cacheKey(['transfers', input]),
        () => sdk.searchTransfers!(input),
        (offers) => qualityFromCount(offers.length),
      )
  }

  if (sdk.searchInsurance) {
    wrapped.searchInsurance = async (
      input: LiveGenericSearchInput,
    ): Promise<LiveInsuranceOffer[]> =>
      timed(
        'searchInsurance',
        'generic',
        cacheKey(['insurance', input]),
        () => sdk.searchInsurance!(input),
        (offers) => qualityFromCount(offers.length),
      )
  }

  if (sdk.searchAirports) {
    wrapped.searchAirports = async (query: string, signal?) =>
      timed(
        'searchAirports',
        'airports',
        cacheKey(['airports', query.trim().toLowerCase()]),
        () => sdk.searchAirports!(query, signal),
        (rows) => qualityFromCount(rows.length),
      )
  }

  if (sdk.getOfferDetails) {
    wrapped.getOfferDetails = (offerId, signal) => sdk.getOfferDetails!(offerId, signal)
  }
  if (sdk.priceOffer) {
    wrapped.priceOffer = (offerId, signal) => sdk.priceOffer!(offerId, signal)
  }
  if (sdk.createOrder) {
    wrapped.createOrder = (offerId, signal) => sdk.createOrder!(offerId, signal)
  }
  if (sdk.cancelOrder) {
    wrapped.cancelOrder = (orderId, signal) => sdk.cancelOrder!(orderId, signal)
  }

  return wrapped
}

/** Test helper: default fetch that always fails (guards against accidental network). */
export const denyNetworkFetch: LiveFetch = async () => {
  throw new Error('network_disabled_in_tests')
}
