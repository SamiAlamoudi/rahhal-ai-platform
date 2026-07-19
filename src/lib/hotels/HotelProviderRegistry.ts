/**
 * Sprint 30 — HotelProviderRegistry with priority failover, cache, retry, rate limit, health.
 */

import type { HotelProvider } from './HotelProvider'
import { HotelHealthMonitor, getHotelHealthMonitor } from './HotelHealthMonitor'
import {
  HotelProviderMetrics,
  getHotelProviderMetrics,
} from './HotelProviderMetrics'
import {
  HotelSearchCache,
  buildHotelCacheKey,
  getSharedHotelSearchCache,
} from './HotelSearchCache'
import { HotelRateLimiter, getHotelRateLimiter } from './rateLimit'
import { DEFAULT_HOTEL_RETRY_POLICY, withHotelRetry, type HotelRetryPolicy } from './retry'
import {
  createBookingConnectivityAdapter,
  createExpediaRapidAdapter,
  createHotelbedsAdapter,
  createMockHotelsAdapter,
} from './adapters'
import type {
  HotelProviderId,
  HotelSearchOptions,
  HotelSearchRequest,
  HotelUnifiedSearchResult,
  NormalizedHotelResult,
} from './types'

export interface HotelProviderRegistryOptions {
  providers?: HotelProvider[]
  cache?: HotelSearchCache<NormalizedHotelResult[]>
  health?: HotelHealthMonitor
  metrics?: HotelProviderMetrics
  rateLimiter?: HotelRateLimiter
  retryPolicy?: HotelRetryPolicy
  /** Default per-attempt timeout. */
  timeoutMs?: number
}

export class HotelProviderRegistry {
  private readonly providers = new Map<HotelProviderId, HotelProvider>()
  private readonly cache: HotelSearchCache<NormalizedHotelResult[]>
  private readonly health: HotelHealthMonitor
  private readonly metrics: HotelProviderMetrics
  private readonly rateLimiter: HotelRateLimiter
  private readonly retryPolicy: HotelRetryPolicy
  private readonly timeoutMs: number

  constructor(options: HotelProviderRegistryOptions = {}) {
    this.cache = options.cache ?? getSharedHotelSearchCache<NormalizedHotelResult[]>()
    this.health = options.health ?? getHotelHealthMonitor()
    this.metrics = options.metrics ?? getHotelProviderMetrics()
    this.rateLimiter = options.rateLimiter ?? getHotelRateLimiter()
    this.retryPolicy = options.retryPolicy ?? DEFAULT_HOTEL_RETRY_POLICY
    this.timeoutMs = options.timeoutMs ?? 2_500

    const initial = options.providers ?? createDefaultHotelProviders()
    for (const provider of initial) {
      this.register(provider)
    }
  }

  register(provider: HotelProvider): void {
    this.providers.set(provider.metadata.id, provider)
  }

  unregister(providerId: HotelProviderId): void {
    this.providers.delete(providerId)
  }

  get(providerId: HotelProviderId): HotelProvider | null {
    return this.providers.get(providerId) ?? null
  }

  list(): HotelProvider[] {
    return [...this.providers.values()].sort(
      (a, b) => b.metadata.priority - a.metadata.priority,
    )
  }

  listAvailable(): HotelProvider[] {
    return this.list().filter(
      (p) => p.isAvailable() && this.health.isHealthyEnough(p.metadata.id),
    )
  }

  /**
   * Unified hotel search across the provider chain with cache, retry, rate limit, failover.
   */
  async search(
    req: HotelSearchRequest,
    options: HotelSearchOptions = {},
  ): Promise<HotelUnifiedSearchResult> {
    const chain = this.resolveChain(options.providerChain)
    const cacheKey = buildHotelCacheKey({
      destination: req.destination,
      checkIn: req.checkIn,
      checkOut: req.checkOut,
      adults: req.adults,
      children: req.children ?? 0,
      rooms: req.rooms ?? 1,
      currency: req.currency ?? 'SAR',
      preferred: (req.preferredHotels ?? []).join(','),
      chain: chain.map((p) => p.metadata.id).join('>'),
    })

    if (!options.bypassCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && cached.length > 0) {
        const providerId = cached[0]?.providerId ?? 'mock_hotels'
        this.metrics.increment(providerId, 'cacheHits')
        return {
          offers: cached,
          providerId,
          providerName: this.get(providerId)?.metadata.displayName ?? String(providerId),
          latencyMs: 0,
          fromCache: true,
          sandbox: cached.every((o) => o.sandbox),
          fallbackCount: 0,
          attempts: [{ providerId, success: true, latencyMs: 0 }],
        }
      }
      this.metrics.increment(chain[0]?.metadata.id ?? 'mock_hotels', 'cacheMisses')
    }

    const attempts: HotelUnifiedSearchResult['attempts'] = []
    let fallbackCount = 0
    const failover = options.failover !== false
    const timeoutMs = options.timeoutMs ?? this.timeoutMs
    const maxRetries = options.maxRetries ?? this.retryPolicy.maxAttempts

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i]
      const providerId = provider.metadata.id
      this.metrics.increment(providerId, 'requests')

      const limit = this.rateLimiter.allow(
        providerId,
        provider.getCapabilities().rateLimitPerMinute,
      )
      if (!limit.allowed) {
        this.metrics.increment(providerId, 'rateLimited')
        this.health.recordFailure(providerId, 'rate_limited', {
          rateLimitedUntil: new Date(Date.now() + limit.retryAfterMs).toISOString(),
        })
        attempts.push({
          providerId,
          success: false,
          latencyMs: 0,
          errorCode: 'rate_limited',
        })
        if (!failover) break
        fallbackCount++
        this.metrics.increment(providerId, 'fallbacks')
        continue
      }

      try {
        const result = await withHotelRetry(
          async (attempt) => {
            if (attempt > 1) this.metrics.increment(providerId, 'retries')
            return await withTimeout(
              provider.searchHotels(req),
              timeoutMs,
              providerId,
            )
          },
          {
            policy: { ...this.retryPolicy, maxAttempts: maxRetries },
            shouldRetry: (error) => {
              const code = (error as { code?: string } | null)?.code
              return code === 'timeout' || code === 'upstream_error' || code === 'rate_limited'
            },
          },
        )

        if (result.success && result.data && result.data.length > 0) {
          this.health.recordSuccess(providerId, result.latencyMs)
          this.metrics.increment(providerId, 'successes')
          this.metrics.recordLatency(providerId, result.latencyMs)
          if (!options.bypassCache) {
            this.cache.set(cacheKey, result.data)
          }
          attempts.push({
            providerId,
            success: true,
            latencyMs: result.latencyMs,
          })
          return {
            offers: result.data,
            providerId,
            providerName: result.providerName,
            latencyMs: result.latencyMs,
            fromCache: false,
            sandbox: result.sandbox,
            fallbackCount,
            attempts,
          }
        }

        const errCode = result.errors[0]?.code ?? 'empty'
        this.health.recordFailure(providerId, errCode, { latencyMs: result.latencyMs })
        this.metrics.increment(providerId, 'failures')
        attempts.push({
          providerId,
          success: false,
          latencyMs: result.latencyMs,
          errorCode: errCode,
        })
      } catch (error) {
        const code = mapThrownCode(error)
        if (code === 'timeout') this.metrics.increment(providerId, 'timeouts')
        if (code === 'rate_limited') {
          this.metrics.increment(providerId, 'rateLimited')
          this.rateLimiter.penalize(providerId)
        }
        this.health.recordFailure(providerId, code)
        this.metrics.increment(providerId, 'failures')
        attempts.push({
          providerId,
          success: false,
          latencyMs: 0,
          errorCode: code,
        })
      }

      if (!failover) break
      if (i < chain.length - 1) {
        fallbackCount++
        this.metrics.increment(providerId, 'fallbacks')
      }
    }

    return {
      offers: [],
      providerId: chain[chain.length - 1]?.metadata.id ?? 'mock_hotels',
      providerName: chain[chain.length - 1]?.metadata.displayName ?? 'Mock Hotels',
      latencyMs: attempts.reduce((sum, a) => sum + a.latencyMs, 0),
      fromCache: false,
      sandbox: true,
      fallbackCount,
      attempts,
    }
  }

  getHealthMonitor(): HotelHealthMonitor {
    return this.health
  }

  getMetrics(): HotelProviderMetrics {
    return this.metrics
  }

  getCache(): HotelSearchCache<NormalizedHotelResult[]> {
    return this.cache
  }

  private resolveChain(preferred?: HotelProviderId[]): HotelProvider[] {
    if (preferred && preferred.length > 0) {
      const chain: HotelProvider[] = []
      for (const id of preferred) {
        const provider = this.providers.get(id)
        if (provider) chain.push(provider)
      }
      return chain.length > 0 ? chain : this.listAvailable()
    }
    return this.listAvailable()
  }
}

export function createDefaultHotelProviders(): HotelProvider[] {
  return [
    createBookingConnectivityAdapter(),
    createHotelbedsAdapter(),
    createExpediaRapidAdapter(),
    createMockHotelsAdapter(),
  ]
}

export function createHotelProviderRegistry(
  options?: HotelProviderRegistryOptions,
): HotelProviderRegistry {
  return new HotelProviderRegistry(options)
}

let sharedRegistry: HotelProviderRegistry | null = null

export function getHotelProviderRegistry(): HotelProviderRegistry {
  if (!sharedRegistry) sharedRegistry = createHotelProviderRegistry()
  return sharedRegistry
}

export function resetHotelProviderRegistry(): void {
  sharedRegistry = null
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerId: HotelProviderId,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Hotel provider ${providerId} timed out`), { code: 'timeout' }))
    }, timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function mapThrownCode(error: unknown): HotelUnifiedSearchResult['attempts'][number]['errorCode'] & string {
  const code = (error as { code?: string } | null)?.code
  if (
    code === 'timeout'
    || code === 'rate_limited'
    || code === 'unavailable'
    || code === 'not_configured'
    || code === 'invalid_input'
    || code === 'upstream_error'
    || code === 'empty'
    || code === 'aborted'
  ) {
    return code
  }
  return 'unknown'
}
