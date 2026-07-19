/**
 * In-memory flight search cache with a 15-minute TTL.
 * Keys are derived from the resolved Amadeus search query.
 */

export const FLIGHT_CACHE_TTL_MS = 15 * 60 * 1000

export interface FlightCacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
}

export function buildFlightCacheKey(parts: Record<string, string | number | boolean | null | undefined>): string {
  const normalized = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] ?? ''}`)
    .join('|')
  return normalized
}

export class FlightCache<T = unknown> {
  private readonly store = new Map<string, FlightCacheEntry<T>>()
  private readonly ttlMs: number

  constructor(ttlMs: number = FLIGHT_CACHE_TTL_MS) {
    this.ttlMs = ttlMs
  }

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: T): void {
    const now = Date.now()
    this.store.set(key, {
      value,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    this.pruneExpired()
    return this.store.size
  }

  pruneExpired(): number {
    const now = Date.now()
    let removed = 0
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key)
        removed++
      }
    }
    return removed
  }
}

/** Shared process-wide flight offer cache (15 minutes). */
let sharedFlightCache: FlightCache | null = null

export function getSharedFlightCache<T = unknown>(): FlightCache<T> {
  if (!sharedFlightCache) {
    sharedFlightCache = new FlightCache()
  }
  return sharedFlightCache as FlightCache<T>
}

export function resetSharedFlightCache(): void {
  sharedFlightCache?.clear()
  sharedFlightCache = null
}
