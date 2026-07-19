/**
 * Sprint 26 — provider search / session / provider caches with TTL.
 */

export type ProviderCacheKind = 'search' | 'session' | 'provider'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>()
  private readonly defaultTtlMs: number

  constructor(defaultTtlMs: number) {
    this.defaultTtlMs = defaultTtlMs
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    this.prune()
    return this.store.size
  }

  prune(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }
}

const searchCaches = new Map<string, TtlCache<unknown>>()
const sessionCaches = new Map<string, TtlCache<unknown>>()
const providerCaches = new Map<string, TtlCache<unknown>>()

function bucket(
  kind: ProviderCacheKind,
): Map<string, TtlCache<unknown>> {
  if (kind === 'search') return searchCaches
  if (kind === 'session') return sessionCaches
  return providerCaches
}

export function getProviderCache<T = unknown>(
  kind: ProviderCacheKind,
  namespace: string,
  ttlMs: number,
): TtlCache<T> {
  const map = bucket(kind)
  let cache = map.get(namespace) as TtlCache<T> | undefined
  if (!cache) {
    cache = new TtlCache<T>(ttlMs)
    map.set(namespace, cache as TtlCache<unknown>)
  }
  return cache
}

export function clearAllProviderCaches(): void {
  searchCaches.clear()
  sessionCaches.clear()
  providerCaches.clear()
}

/** Stable cache key from provider id + search context fields. */
export function buildProviderCacheKey(
  providerId: string,
  parts: Record<string, unknown>,
): string {
  const sorted = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${JSON.stringify(parts[k] ?? null)}`)
    .join('|')
  return `${providerId}::${sorted}`
}
