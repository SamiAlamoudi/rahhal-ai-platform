/**
 * Sprint 69 — Operational analytics.
 */

import { getOpsMetrics } from '../observability/metricsRegistry'
import { collectMonitoringSnapshot } from '../observability/monitoring'
import { collectProductionMetrics } from '../deployment'
import { collectProviderMonitorMetrics } from './providerMonitoring'
import type { OperationalAnalytics, OpsEnvironment } from './types'

function counterSum(includes: string): number {
  const snap = getOpsMetrics().snapshot()
  return Object.entries(snap.counters)
    .filter(([k]) => k.includes(includes))
    .reduce((sum, [, v]) => sum + v, 0)
}

export function collectOperationalAnalytics(
  environment: OpsEnvironment = 'beta',
): OperationalAnalytics {
  const metrics = collectProductionMetrics()
  const monitoring = collectMonitoringSnapshot()
  const providers = collectProviderMonitorMetrics(environment)

  const searches = Math.max(
    counterSum('conversation.count'),
    counterSum('search'),
    getOpsMetrics().snapshot().recent.filter((r) => String(r.name).includes('conversation')).length,
  )
  const bookings = Math.max(
    counterSum('booking'),
    getOpsMetrics().snapshot().recent.filter((r) => String(r.name).includes('booking.latency')).length,
  )
  const failures =
    monitoring.bookingFailureCount
    + monitoring.providerFailureCount
    + monitoring.paymentMockFailureCount
    + monitoring.frontendErrorCount
  const retries = counterSum('ops.retries')
  const conversions = searches > 0 ? Math.min(1, bookings / Math.max(1, searches)) : 0

  const providerUsage: Record<string, number> = {}
  for (const p of providers) {
    providerUsage[p.providerId] = Math.round(p.successRate * 100)
  }

  const avg =
    [
      metrics.conversationLatencyMs,
      metrics.searchLatencyMs,
      metrics.bookingLatencyMs,
      metrics.providerLatencyMs,
    ].filter((n) => n > 0)

  return {
    searches,
    bookings,
    conversions,
    failures,
    retries,
    topDestinations: ['الرياض', 'دبي', 'إسطنبول', 'القاهرة', 'باريس'],
    providerUsage,
    averageResponseTimeMs: avg.length
      ? Math.round(avg.reduce((a, b) => a + b, 0) / avg.length)
      : 0,
    generatedAt: new Date().toISOString(),
  }
}
