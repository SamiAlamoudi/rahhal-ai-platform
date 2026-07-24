/**
 * Phase 2 Stage 4 — In-memory runtime cache for immutable stage results.
 * Session-scoped. No PII keys beyond opaque hashes of known slots.
 */

import type { RuntimeStageId } from './runtimeTypes'

export interface RuntimeCacheEntry {
  stageId: RuntimeStageId
  key: string
  output: unknown
  createdAt: number
}

export interface RuntimeCacheStats {
  hits: number
  misses: number
  size: number
}

export class RuntimeCache {
  private readonly store = new Map<string, RuntimeCacheEntry>()
  private hits = 0
  private misses = 0
  private readonly maxEntries: number

  constructor(maxEntries = 128) {
    this.maxEntries = maxEntries
  }

  static hashContext(parts: Record<string, unknown>): string {
    const json = JSON.stringify(parts, Object.keys(parts).sort())
    let h = 2166136261
    for (let i = 0; i < json.length; i += 1) {
      h ^= json.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return (h >>> 0).toString(36)
  }

  makeKey(sessionId: string, stageId: RuntimeStageId, contextHash: string): string {
    return `${sessionId}::${stageId}::${contextHash}`
  }

  get(key: string): RuntimeCacheEntry | null {
    const hit = this.store.get(key)
    if (!hit) {
      this.misses += 1
      return null
    }
    this.hits += 1
    return hit
  }

  set(entry: RuntimeCacheEntry): void {
    if (this.store.size >= this.maxEntries) {
      const first = this.store.keys().next().value
      if (first != null) this.store.delete(first)
    }
    this.store.set(entry.key, entry)
  }

  has(key: string): boolean {
    return this.store.has(key)
  }

  clear(): void {
    this.store.clear()
    this.hits = 0
    this.misses = 0
  }

  stats(): RuntimeCacheStats {
    return { hits: this.hits, misses: this.misses, size: this.store.size }
  }
}

/** Process-wide cache for tests / optional session reuse. */
let sharedCache: RuntimeCache | null = null

export function getSharedRuntimeCache(): RuntimeCache {
  if (!sharedCache) sharedCache = new RuntimeCache()
  return sharedCache
}

export function resetSharedRuntimeCache(): void {
  sharedCache?.clear()
  sharedCache = null
}
