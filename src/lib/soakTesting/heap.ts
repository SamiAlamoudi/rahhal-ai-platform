/**
 * Sprint 19 — heap sampling helpers.
 */

import type { HeapSample } from './types'

export function sampleHeap(): HeapSample {
  let heapUsedMb = 0
  try {
    const mem = (globalThis as {
      process?: { memoryUsage?: () => { heapUsed: number } }
    }).process?.memoryUsage?.()
    if (mem) heapUsedMb = mem.heapUsed / (1024 * 1024)
  } catch {
    /* ignore */
  }
  if (!heapUsedMb) {
    try {
      const perf = (globalThis as {
        performance?: { memory?: { usedJSHeapSize?: number } }
      }).performance
      if (perf?.memory?.usedJSHeapSize) {
        heapUsedMb = perf.memory.usedJSHeapSize / (1024 * 1024)
      }
    } catch {
      /* ignore */
    }
  }
  return { at: new Date().toISOString(), heapUsedMb }
}

export function estimateCpu(loadUnits: number): number {
  return Math.min(0.95, loadUnits / 80_000)
}
