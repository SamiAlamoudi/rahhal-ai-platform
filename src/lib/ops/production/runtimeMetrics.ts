/**
 * Phase AI — runtime metrics helpers (request / planning / booking / failures).
 * Bridges into OpsMetricsRegistry without breaking existing metric names.
 */

import { getOpsMetrics, type OpsMetricName } from '../observability/metricsRegistry'

/** Additive Phase AI metric names. */
export type ProductionMetricName =
  | OpsMetricName
  | 'request.duration_ms'
  | 'planning.duration_ms'
  | 'booking.duration_ms'
  | 'ops.failures'
  | 'ops.retries'
  | 'ops.cancellations'

function asOpsName(name: ProductionMetricName): OpsMetricName {
  // OpsMetricsRegistry is typed to OpsMetricName; cast for additive Phase AI names
  // until registry typing is widened (done in metricsRegistry update).
  return name as OpsMetricName
}

export function recordRequestDuration(durationMs: number, tags: Record<string, string> = {}): void {
  getOpsMetrics().observe(asOpsName('request.duration_ms'), durationMs, tags)
}

export function recordPlanningDuration(durationMs: number, tags: Record<string, string> = {}): void {
  getOpsMetrics().observe(asOpsName('planning.duration_ms'), durationMs, tags)
}

export function recordBookingDuration(durationMs: number, tags: Record<string, string> = {}): void {
  getOpsMetrics().observe(asOpsName('booking.duration_ms'), durationMs, tags)
}

export function recordFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr(asOpsName('ops.failures'), tags)
}

export function recordRetry(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr(asOpsName('ops.retries'), tags)
}

export function recordCancellation(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr(asOpsName('ops.cancellations'), tags)
}

export async function timeAsync<T>(
  metric: 'request.duration_ms' | 'planning.duration_ms' | 'booking.duration_ms',
  fn: () => Promise<T>,
  tags: Record<string, string> = {},
): Promise<T> {
  const started = Date.now()
  try {
    return await fn()
  } finally {
    getOpsMetrics().observe(asOpsName(metric), Date.now() - started, tags)
  }
}
