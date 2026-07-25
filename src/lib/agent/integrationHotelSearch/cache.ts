/**
 * Integration Sprint 3 — smart conversation hotel-search cache (15 min).
 */

import type { ConversationHotelSearchResult } from './types'

export type ConversationHotelCacheKeyInput = {
  destination: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  rooms: number
  currency: string
  hotelPreference?: string | null
  preferredArea?: string | null
  breakfastRequired?: boolean | null
  freeCancellationRequired?: boolean | null
  amenities?: string[]
  live: boolean
}

export class ConversationHotelSearchCache {
  private readonly store = new Map<string, { expiresAt: number; value: ConversationHotelSearchResult }>()
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number
  hits = 0
  misses = 0

  constructor(options?: { ttlMs?: number; maxEntries?: number; now?: () => number }) {
    this.ttlMs = options?.ttlMs ?? 15 * 60 * 1000
    this.maxEntries = options?.maxEntries ?? 200
    this.now = options?.now ?? (() => Date.now())
  }

  static key(input: ConversationHotelCacheKeyInput): string {
    return [
      input.live ? 'live' : 'mock',
      input.destination.trim().toLowerCase(),
      input.checkIn,
      input.checkOut,
      String(input.adults),
      String(input.children),
      String(input.rooms),
      input.currency.toUpperCase(),
      (input.hotelPreference ?? '-').toLowerCase(),
      (input.preferredArea ?? '-').toLowerCase(),
      input.breakfastRequired ? 'bf1' : 'bf0',
      input.freeCancellationRequired ? 'fc1' : 'fc0',
      (input.amenities ?? []).map((a) => a.toLowerCase()).sort().join(','),
    ].join('|')
  }

  get(key: string): ConversationHotelSearchResult | null {
    const entry = this.store.get(key)
    if (!entry) {
      this.misses += 1
      return null
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key)
      this.misses += 1
      return null
    }
    this.hits += 1
    return { ...entry.value, cacheHit: true }
  }

  set(key: string, value: ConversationHotelSearchResult): void {
    if (this.store.size >= this.maxEntries) {
      const first = this.store.keys().next().value
      if (first) this.store.delete(first)
    }
    this.store.set(key, {
      expiresAt: this.now() + this.ttlMs,
      value: { ...value, cacheHit: false },
    })
  }

  clear(): void {
    this.store.clear()
    this.hits = 0
    this.misses = 0
  }

  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.store.size }
  }
}

let defaultCache: ConversationHotelSearchCache | null = null

export function getConversationHotelSearchCache(): ConversationHotelSearchCache {
  if (!defaultCache) defaultCache = new ConversationHotelSearchCache()
  return defaultCache
}

export function resetConversationHotelSearchCache(): void {
  defaultCache?.clear()
  defaultCache = null
}
