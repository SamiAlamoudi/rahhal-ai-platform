/**
 * Integration Sprint 2 — smart conversation flight-search cache.
 * Avoids duplicate identical searches; expires safely (default 15 min).
 */

import type { ConversationFlightSearchResult } from './types'

export type ConversationFlightCacheKeyInput = {
  origin: string
  destination: string
  departureDate: string
  returnDate: string | null
  adults: number
  children: number
  cabin: string | null
  currency: string
  preferredAirline?: string | null
  preferredDepartureTime?: string | null
  live: boolean
}

export class ConversationFlightSearchCache {
  private readonly store = new Map<string, { expiresAt: number; value: ConversationFlightSearchResult }>()
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

  static key(input: ConversationFlightCacheKeyInput): string {
    return [
      input.live ? 'live' : 'mock',
      input.origin.toUpperCase(),
      input.destination.toUpperCase(),
      input.departureDate,
      input.returnDate ?? '-',
      String(input.adults),
      String(input.children),
      (input.cabin ?? 'economy').toLowerCase(),
      input.currency.toUpperCase(),
      (input.preferredAirline ?? '-').toLowerCase(),
      (input.preferredDepartureTime ?? '-').toLowerCase(),
    ].join('|')
  }

  get(key: string): ConversationFlightSearchResult | null {
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
    return {
      ...entry.value,
      cacheHit: true,
    }
  }

  set(key: string, value: ConversationFlightSearchResult): void {
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

let defaultCache: ConversationFlightSearchCache | null = null

export function getConversationFlightSearchCache(): ConversationFlightSearchCache {
  if (!defaultCache) defaultCache = new ConversationFlightSearchCache()
  return defaultCache
}

export function resetConversationFlightSearchCache(): void {
  defaultCache?.clear()
  defaultCache = null
}
