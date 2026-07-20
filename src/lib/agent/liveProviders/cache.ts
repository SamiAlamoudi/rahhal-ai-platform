/**
 * Smart Cache — Sprint 56
 *
 * Caches airport search, cities, hotels, flight routes, currencies.
 * TTL is configurable per namespace.
 */

export type CacheNamespace =
  | 'airports'
  | 'cities'
  | 'hotels'
  | 'flight_routes'
  | 'currencies'
  | 'generic'

export type SmartCacheOptions = {
  defaultTtlMs?: number
  ttlByNamespace?: Partial<Record<CacheNamespace, number>>
  maxEntries?: number
  now?: () => number
}

type CacheEntry = {
  value: unknown
  expiresAt: number
  namespace: CacheNamespace
  hits: number
}

export type SmartCacheStats = {
  hits: number
  misses: number
  size: number
  hitRatio: number
}

const DEFAULT_TTL: Record<CacheNamespace, number> = {
  airports: 24 * 60 * 60 * 1000,
  cities: 24 * 60 * 60 * 1000,
  hotels: 30 * 60 * 1000,
  flight_routes: 15 * 60 * 1000,
  currencies: 12 * 60 * 60 * 1000,
  generic: 5 * 60 * 1000,
}

export class SmartCache {
  private readonly store = new Map<string, CacheEntry>()
  private readonly defaultTtlMs: number
  private readonly ttlByNamespace: Partial<Record<CacheNamespace, number>>
  private readonly maxEntries: number
  private readonly now: () => number
  private hits = 0
  private misses = 0

  constructor(options: SmartCacheOptions = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL.generic
    this.ttlByNamespace = options.ttlByNamespace ?? {}
    this.maxEntries = options.maxEntries ?? 500
    this.now = options.now ?? (() => Date.now())
  }

  private key(namespace: CacheNamespace, key: string): string {
    return `${namespace}::${key}`
  }

  private ttl(namespace: CacheNamespace): number {
    return this.ttlByNamespace[namespace] ?? DEFAULT_TTL[namespace] ?? this.defaultTtlMs
  }

  private evictIfNeeded(): void {
    if (this.store.size <= this.maxEntries) return
    const now = this.now()
    for (const [k, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(k)
    }
    if (this.store.size <= this.maxEntries) return
    // Evict least-hit entries first
    const ranked = [...this.store.entries()].sort((a, b) => a[1].hits - b[1].hits)
    const toRemove = ranked.slice(0, Math.max(1, this.store.size - this.maxEntries))
    for (const [k] of toRemove) this.store.delete(k)
  }

  get<T>(namespace: CacheNamespace, key: string): T | undefined {
    const full = this.key(namespace, key)
    const entry = this.store.get(full)
    if (!entry) {
      this.misses += 1
      return undefined
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(full)
      this.misses += 1
      return undefined
    }
    entry.hits += 1
    this.hits += 1
    return entry.value as T
  }

  set<T>(namespace: CacheNamespace, key: string, value: T, ttlMs?: number): void {
    const full = this.key(namespace, key)
    this.store.set(full, {
      value,
      expiresAt: this.now() + (ttlMs ?? this.ttl(namespace)),
      namespace,
      hits: 0,
    })
    this.evictIfNeeded()
  }

  async getOrSet<T>(
    namespace: CacheNamespace,
    key: string,
    loader: () => Promise<T>,
    ttlMs?: number,
  ): Promise<{ value: T; fromCache: boolean }> {
    const cached = this.get<T>(namespace, key)
    if (cached !== undefined) return { value: cached, fromCache: true }
    const value = await loader()
    this.set(namespace, key, value, ttlMs)
    return { value, fromCache: false }
  }

  clear(namespace?: CacheNamespace): void {
    if (!namespace) {
      this.store.clear()
      return
    }
    for (const [k, entry] of this.store) {
      if (entry.namespace === namespace) this.store.delete(k)
    }
  }

  stats(): SmartCacheStats {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      hitRatio: total === 0 ? 0 : this.hits / total,
    }
  }
}
