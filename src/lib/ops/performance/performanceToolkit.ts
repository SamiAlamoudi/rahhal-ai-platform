/**
 * Performance helpers — dedupe, cache, budgets, slow-call logging.
 */

import { getLogger } from '../logging/structuredLogger'

export const PERFORMANCE_BUDGETS = {
  /** Soft budget for provider aggregate (ms). */
  providerAggregateMs: 2_500,
  /** Soft budget for single provider call (ms). */
  providerCallMs: 1_200,
  /** Target gzipped main bundle (kB) — documented gate. */
  mainBundleGzipKb: 350,
  /** Long task threshold (ms). */
  longTaskMs: 50,
} as const

export class RequestDeduper {
  private readonly inflight = new Map<string, Promise<unknown>>()

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) return existing as Promise<T>
    const promise = Promise.resolve()
      .then(fn)
      .finally(() => {
        this.inflight.delete(key)
      })
    this.inflight.set(key, promise)
    return promise
  }

  size(): number {
    return this.inflight.size
  }

  clear(): void {
    this.inflight.clear()
  }
}

export class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>()
  private readonly defaultTtlMs: number

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs
  }

  get(key: string): V | undefined {
    const row = this.store.get(key)
    if (!row) return undefined
    if (row.expiresAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return row.value
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  clear(): void {
    this.store.clear()
  }
}

export function logSlowOperation(
  domain: string,
  operation: string,
  durationMs: number,
  budgetMs = PERFORMANCE_BUDGETS.providerCallMs,
): void {
  if (durationMs <= budgetMs) return
  getLogger().warn(domain, operation, 'slow_operation', {
    durationMs,
    budgetMs,
  })
}

/** Lightweight long-task detector (no-op when PerformanceObserver unavailable). */
export function installLongTaskDetector(onLongTask?: (durationMs: number) => void): () => void {
  if (typeof PerformanceObserver === 'undefined') return () => {}
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= PERFORMANCE_BUDGETS.longTaskMs) {
          onLongTask?.(entry.duration)
          getLogger().warn('performance', 'long_task', 'long_task_detected', {
            durationMs: Math.round(entry.duration),
            name: entry.name,
          })
        }
      }
    })
    observer.observe({ entryTypes: ['longtask'] as string[] })
    return () => observer.disconnect()
  } catch {
    return () => {}
  }
}

export function estimateMemoryPressure(): {
  usedJsHeapBytes: number | null
  ok: boolean
} {
  const perf = globalThis.performance as Performance & {
    memory?: { usedJSHeapSize?: number }
  }
  const used = perf?.memory?.usedJSHeapSize ?? null
  return {
    usedJsHeapBytes: used,
    ok: used == null || used < 512 * 1024 * 1024,
  }
}
