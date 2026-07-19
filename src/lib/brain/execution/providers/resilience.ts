/**
 * Sprint 26 — wrap a primary provider with fallback + monitoring + cache.
 */

import type {
  FlightProvider,
  HotelProvider,
  TransportProvider,
  ActivitiesProvider,
  PackageProvider,
  ProviderSearchContext,
  FlightSearchPayload,
  HotelSearchPayload,
  TransportSearchPayload,
  ActivitiesSearchPayload,
  PackageSearchPayload,
} from '../types'
import { buildProviderCacheKey, getProviderCache } from './cache'
import { recordProviderSample } from './monitoring'
import type { ExecutionProviderDomain } from './config'

type AnyProvider =
  | FlightProvider
  | HotelProvider
  | TransportProvider
  | ActivitiesProvider
  | PackageProvider

type AnyPayload =
  | FlightSearchPayload
  | HotelSearchPayload
  | TransportSearchPayload
  | ActivitiesSearchPayload
  | PackageSearchPayload

export interface WithProviderResilienceOptions {
  domain: ExecutionProviderDomain
  primary: AnyProvider
  fallback?: AnyProvider | null
  cacheTtlMs?: number
  useCache?: boolean
}

function offerCount(payload: AnyPayload): number {
  return Array.isArray(payload.offers) ? payload.offers.length : 0
}

function cacheParts(ctx: ProviderSearchContext): Record<string, unknown> {
  const m = ctx.task.metadata
  return {
    tripPlanId: ctx.tripPlan.id,
    destination: m.destination,
    departureCity: m.departureCity,
    startDate: m.startDate,
    endDate: m.endDate,
    adults: m.adults,
    cabinClass: m.cabinClass,
    currency: m.currency,
    taskType: ctx.task.type,
  }
}

/**
 * Decorate a provider with cache, monitoring, and optional mock fallback.
 */
export function withProviderResilience(
  options: WithProviderResilienceOptions,
): AnyProvider {
  const {
    domain,
    primary,
    fallback = null,
    cacheTtlMs = 60_000,
    useCache = true,
  } = options

  const search = async (ctx: ProviderSearchContext): Promise<AnyPayload> => {
    const cache = useCache
      ? getProviderCache<AnyPayload>('provider', domain, cacheTtlMs)
      : null
    const cacheKey = buildProviderCacheKey(primary.id, cacheParts(ctx))
    if (cache) {
      const hit = cache.get(cacheKey)
      if (hit) return hit
    }

    const started = Date.now()
    try {
      const payload = (await primary.search(ctx)) as AnyPayload
      recordProviderSample({
        providerId: primary.id,
        domain,
        ok: true,
        latencyMs: Date.now() - started,
        offerCount: offerCount(payload),
        at: new Date().toISOString(),
      })
      if (cache) cache.set(cacheKey, payload, cacheTtlMs)
      // Also mirror into search + session caches
      if (useCache) {
        getProviderCache<AnyPayload>('search', domain, cacheTtlMs).set(
          cacheKey,
          payload,
          cacheTtlMs,
        )
        getProviderCache<AnyPayload>(
          'session',
          ctx.tripPlan.conversationId,
          cacheTtlMs,
        ).set(cacheKey, payload, cacheTtlMs)
      }
      return payload
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      recordProviderSample({
        providerId: primary.id,
        domain,
        ok: false,
        latencyMs: Date.now() - started,
        offerCount: 0,
        at: new Date().toISOString(),
        error: message,
      })
      if (fallback) {
        const fbStarted = Date.now()
        const payload = (await fallback.search(ctx)) as AnyPayload
        recordProviderSample({
          providerId: fallback.id,
          domain,
          ok: true,
          latencyMs: Date.now() - fbStarted,
          offerCount: offerCount(payload),
          at: new Date().toISOString(),
        })
        if (cache) cache.set(cacheKey, payload, cacheTtlMs)
        return payload
      }
      throw err
    }
  }

  return {
    id: primary.id,
    search,
  } as AnyProvider
}
