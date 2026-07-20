/**
 * Sprint 52 — Computation cache for reusable OS reasoning.
 */

type CacheEntry<T> = { value: T; expiresAt: number }

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return null
  }
  return hit.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs = 60_000): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

export function cacheWrap<T>(key: string, ttlMs: number, compute: () => T): T {
  const cached = cacheGet<T>(key)
  if (cached != null) return cached
  return cacheSet(key, compute(), ttlMs)
}

export function resetExecutiveOsCache(): void {
  store.clear()
}
