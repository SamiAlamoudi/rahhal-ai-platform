/**
 * Phase W — proactive per-provider rate limiter (token bucket style).
 */

export interface RateLimiterOptions {
  /** Default requests allowed per minute when adapter declares none. */
  defaultPerMinute?: number
  clock?: () => number
}

export interface RateLimitDecision {
  allowed: boolean
  retryAfterMs: number | null
  remaining: number
}

export interface ProviderRateLimiter {
  /** Configure / override limit for a provider. */
  configure(providerId: string, perMinute: number): void
  allow(providerId: string, perMinute?: number | null): RateLimitDecision
  reset(providerId?: string): void
}

interface Bucket {
  perMinute: number
  tokens: number
  updatedAt: number
}

export function createProviderRateLimiter(options: RateLimiterOptions = {}): ProviderRateLimiter {
  const defaultPerMinute = options.defaultPerMinute ?? 60
  const clock = options.clock ?? (() => Date.now())
  const buckets = new Map<string, Bucket>()

  const ensure = (providerId: string, perMinute: number): Bucket => {
    const existing = buckets.get(providerId)
    if (existing) {
      existing.perMinute = perMinute
      return existing
    }
    const created: Bucket = {
      perMinute,
      tokens: perMinute,
      updatedAt: clock(),
    }
    buckets.set(providerId, created)
    return created
  }

  const refill = (bucket: Bucket): void => {
    const now = clock()
    const elapsed = Math.max(0, now - bucket.updatedAt)
    if (elapsed <= 0) return
    const ratePerMs = bucket.perMinute / 60_000
    bucket.tokens = Math.min(bucket.perMinute, bucket.tokens + elapsed * ratePerMs)
    bucket.updatedAt = now
  }

  return {
    configure(providerId, perMinute) {
      ensure(providerId, Math.max(1, perMinute))
    },
    allow(providerId, perMinute) {
      const limit = Math.max(1, perMinute ?? defaultPerMinute)
      const bucket = ensure(providerId, limit)
      refill(bucket)
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1
        return {
          allowed: true,
          retryAfterMs: null,
          remaining: Math.floor(bucket.tokens),
        }
      }
      const need = 1 - bucket.tokens
      const retryAfterMs = Math.ceil(need / (bucket.perMinute / 60_000))
      return {
        allowed: false,
        retryAfterMs,
        remaining: 0,
      }
    },
    reset(providerId) {
      if (providerId) buckets.delete(providerId)
      else buckets.clear()
    },
  }
}
