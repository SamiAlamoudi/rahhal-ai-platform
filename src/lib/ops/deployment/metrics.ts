/**
 * Sprint 68 — Production metrics snapshot (composes ops metrics + domain timers).
 */

import { getOpsMetrics } from '../observability/metricsRegistry'
import { estimateMemoryPressure } from '../performance/performanceToolkit'
import type { ProductionMetricsSnapshot } from './types'

function avgLatency(nameIncludes: string): number {
  const snap = getOpsMetrics().snapshot()
  const samples = snap.recent.filter(
    (r) => String(r.name).includes(nameIncludes) && typeof r.value === 'number',
  )
  if (samples.length === 0) return 0
  return Math.round(samples.reduce((a, s) => a + (s.value as number), 0) / samples.length)
}

function counterSum(prefix: string): number {
  const snap = getOpsMetrics().snapshot()
  return Object.entries(snap.counters)
    .filter(([k]) => k.startsWith(prefix) || k.includes(prefix))
    .reduce((sum, [, v]) => sum + v, 0)
}

export function collectProductionMetrics(input?: {
  now?: () => number
}): ProductionMetricsSnapshot {
  const now = input?.now ?? (() => Date.now())
  const snap = getOpsMetrics().snapshot()
  const errors = counterSum('error') + counterSum('failures')
  const retries = counterSum('retry')
  const timeouts = counterSum('timeout')
  const total = Math.max(1, snap.recent.length)
  const memory = estimateMemoryPressure()
  const used = memory.usedJsHeapBytes
  const memoryPressure: ProductionMetricsSnapshot['memoryPressure'] =
    used == null
      ? 'unknown'
      : used > 400 * 1024 * 1024
        ? 'high'
        : used > 200 * 1024 * 1024
          ? 'medium'
          : 'low'

  return {
    conversationLatencyMs: avgLatency('conversation.latency'),
    searchLatencyMs: avgLatency('search') || avgLatency('provider.latency'),
    bookingLatencyMs: avgLatency('booking.latency'),
    providerLatencyMs: avgLatency('provider.latency'),
    tripLatencyMs: avgLatency('trip.latency'),
    documentLatencyMs: avgLatency('document.latency'),
    paymentLatencyMs: avgLatency('payment'),
    errorRate: errors / total,
    retryRate: retries / total,
    timeoutCount: timeouts,
    memoryPressure: memory.ok === false ? 'high' : memoryPressure,
    cpuPressure: 'unknown',
    generatedAt: new Date(now()).toISOString(),
  }
}
