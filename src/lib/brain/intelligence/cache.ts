/**
 * Sprint 53 — multi-layer live cache (L1 memory + L2 soft + offline fallback).
 */

interface Entry<T> {
  value: T
  expiresAt: number
  softExpiresAt: number
  stale: boolean
}

const l1 = new Map<string, Entry<unknown>>()
const offline = new Map<string, unknown>()
let hits = 0
let misses = 0

export interface CacheGetResult<T> {
  value: T | null
  hit: 'fresh' | 'soft' | 'offline' | 'miss'
}

export function liveCacheGet<T>(key: string): CacheGetResult<T> {
  const now = Date.now()
  const entry = l1.get(key) as Entry<T> | undefined
  if (entry) {
    if (now <= entry.expiresAt) {
      hits += 1
      return { value: entry.value, hit: 'fresh' }
    }
    if (now <= entry.softExpiresAt) {
      hits += 1
      entry.stale = true
      return { value: entry.value, hit: 'soft' }
    }
    l1.delete(key)
  }
  if (offline.has(key)) {
    hits += 1
    return { value: offline.get(key) as T, hit: 'offline' }
  }
  misses += 1
  return { value: null, hit: 'miss' }
}

export function liveCacheSet<T>(key: string, value: T, ttlMs = 60_000, softTtlMs = 300_000): T {
  const now = Date.now()
  l1.set(key, {
    value,
    expiresAt: now + ttlMs,
    softExpiresAt: now + softTtlMs,
    stale: false,
  })
  offline.set(key, value)
  return value
}

export function liveCacheInvalidate(prefix?: string): void {
  if (!prefix) {
    l1.clear()
    return
  }
  for (const key of l1.keys()) {
    if (key.startsWith(prefix)) l1.delete(key)
  }
}

export function liveCacheStats(): { hits: number; misses: number; hitRatio: number; size: number } {
  const total = hits + misses
  return {
    hits,
    misses,
    hitRatio: total === 0 ? 0 : hits / total,
    size: l1.size,
  }
}

export function resetLiveCache(): void {
  l1.clear()
  offline.clear()
  hits = 0
  misses = 0
}

/** Background refresh marker — callers may revalidate soft entries. */
export function liveCacheNeedsRefresh(key: string): boolean {
  const entry = l1.get(key)
  if (!entry) return true
  return Date.now() > entry.expiresAt
}
