/**
 * Sprint 30 — Token-bucket rate limiter for hotel providers.
 */

import type { HotelProviderId } from './types'

export interface HotelRateLimitConfig {
  defaultPerMinute: number
  coolDownMs: number
}

export const DEFAULT_HOTEL_RATE_LIMIT: HotelRateLimitConfig = {
  defaultPerMinute: 60,
  coolDownMs: 2000,
}

export interface HotelRateLimitDecision {
  allowed: boolean
  retryAfterMs: number
  remaining: number
}

interface Bucket {
  tokens: number
  capacity: number
  refillPerMs: number
  updatedAt: number
  coolDownUntil: number
}

export class HotelRateLimiter {
  private readonly buckets = new Map<HotelProviderId, Bucket>()
  private readonly config: HotelRateLimitConfig

  constructor(config: Partial<HotelRateLimitConfig> = {}) {
    this.config = { ...DEFAULT_HOTEL_RATE_LIMIT, ...config }
  }

  allow(providerId: HotelProviderId, perMinute?: number): HotelRateLimitDecision {
    const capacity = Math.max(1, perMinute ?? this.config.defaultPerMinute)
    const now = Date.now()
    let bucket = this.buckets.get(providerId)
    if (!bucket || bucket.capacity !== capacity) {
      bucket = {
        tokens: capacity,
        capacity,
        refillPerMs: capacity / 60_000,
        updatedAt: now,
        coolDownUntil: 0,
      }
      this.buckets.set(providerId, bucket)
    }

    this.refill(bucket, now)

    if (bucket.coolDownUntil > now) {
      return {
        allowed: false,
        retryAfterMs: bucket.coolDownUntil - now,
        remaining: Math.floor(bucket.tokens),
      }
    }

    if (bucket.tokens < 1) {
      bucket.coolDownUntil = now + this.config.coolDownMs
      return {
        allowed: false,
        retryAfterMs: this.config.coolDownMs,
        remaining: 0,
      }
    }

    bucket.tokens -= 1
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.floor(bucket.tokens),
    }
  }

  penalize(providerId: HotelProviderId, retryAfterMs?: number): void {
    const bucket = this.buckets.get(providerId)
    const coolDown = retryAfterMs ?? this.config.coolDownMs
    if (!bucket) {
      this.buckets.set(providerId, {
        tokens: 0,
        capacity: this.config.defaultPerMinute,
        refillPerMs: this.config.defaultPerMinute / 60_000,
        updatedAt: Date.now(),
        coolDownUntil: Date.now() + coolDown,
      })
      return
    }
    bucket.coolDownUntil = Date.now() + coolDown
    bucket.tokens = 0
  }

  reset(providerId?: HotelProviderId): void {
    if (providerId) {
      this.buckets.delete(providerId)
      return
    }
    this.buckets.clear()
  }

  private refill(bucket: Bucket, now: number): void {
    const elapsed = Math.max(0, now - bucket.updatedAt)
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerMs)
    bucket.updatedAt = now
  }
}

let sharedLimiter: HotelRateLimiter | null = null

export function getHotelRateLimiter(): HotelRateLimiter {
  if (!sharedLimiter) sharedLimiter = new HotelRateLimiter()
  return sharedLimiter
}

export function resetHotelRateLimiter(): void {
  sharedLimiter?.reset()
  sharedLimiter = null
}
