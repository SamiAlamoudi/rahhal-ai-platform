/**
 * Sprint 30 — Hotel search cache (15-minute TTL, Amadeus FlightCache pattern).
 */

export const HOTEL_CACHE_TTL_MS = 15 * 60 * 1000

export interface HotelCacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
}

export function buildHotelCacheKey(
  parts: Record<string, string | number | boolean | null | undefined>,
): string {
  return Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] ?? ''}`)
    .join('|')
}

export class HotelSearchCache<T = unknown> {
  private readonly store = new Map<string, HotelCacheEntry<T>>()
  private readonly ttlMs: number

  constructor(ttlMs: number = HOTEL_CACHE_TTL_MS) {
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

let sharedHotelCache: HotelSearchCache | null = null

export function getSharedHotelSearchCache<T = unknown>(): HotelSearchCache<T> {
  if (!sharedHotelCache) {
    sharedHotelCache = new HotelSearchCache()
  }
  return sharedHotelCache as HotelSearchCache<T>
}

export function resetSharedHotelSearchCache(): void {
  sharedHotelCache?.clear()
  sharedHotelCache = null
}
