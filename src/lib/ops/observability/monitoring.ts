/**
 * Phase AA — production monitoring snapshot and signal recorders.
 * Provider-neutral; consumes existing ops metrics, health probes, and DLQ.
 */

import { getDeadLetterQueue } from '../reliability/deadLetter'
import { estimateMemoryPressure } from '../performance/performanceToolkit'
import { checkHealth, checkLiveness, checkReadiness, type HealthProbeOptions, type ProbeStatus } from './health'
import { getOpsMetrics, type OpsMetricsSnapshot } from './metricsRegistry'

export type AffectedService =
  | 'spa'
  | 'edge_functions'
  | 'auth'
  | 'database'
  | 'providers'
  | 'booking'
  | 'payment'
  | 'ticketing'
  | 'notifications'
  | 'queue'

export interface MonitoringSnapshot {
  ts: string
  liveness: ProbeStatus
  readiness: ProbeStatus
  health: ProbeStatus
  metrics: OpsMetricsSnapshot
  deadLetterCount: number
  circuitBreakersOpen: number
  memoryPressure: 'low' | 'medium' | 'high'
  slowRequestCount: number
  providerFallbackCount: number
  providerFailureCount: number
  bookingFailureCount: number
  paymentMockFailureCount: number
  ticketingFailureCount: number
  notificationFailureCount: number
  authFailureCount: number
  frontendErrorCount: number
  databaseErrorCount: number
  edgeFunctionFailureCount: number
  queueBacklog: number
  secretValidationFailureCount: number
}

export interface MonitoringOptions extends HealthProbeOptions {
  circuitBreakersOpen?: number
  queueBacklog?: number
}

function mapMemoryPressure(): 'low' | 'medium' | 'high' {
  const est = estimateMemoryPressure()
  if (est.usedJsHeapBytes == null) return 'low'
  if (!est.ok || est.usedJsHeapBytes > 400 * 1024 * 1024) return 'high'
  if (est.usedJsHeapBytes > 256 * 1024 * 1024) return 'medium'
  return 'low'
}
function sumCounter(snap: OpsMetricsSnapshot, prefix: string): number {
  return Object.entries(snap.counters)
    .filter(([k]) => k.startsWith(prefix))
    .reduce((sum, [, v]) => sum + v, 0)
}

function countOpenCircuits(snap: OpsMetricsSnapshot): number {
  return Object.entries(snap.gauges)
    .filter(([k, v]) => k.startsWith('provider.circuit_open') && v >= 1)
    .length
}

/** Aggregate operational signals for alerting and incident detection. */
export function collectMonitoringSnapshot(
  options: MonitoringOptions = {},
): MonitoringSnapshot {
  const metrics = getOpsMetrics().snapshot()
  const liveness = checkLiveness()
  const readiness = checkReadiness(options)
  const health = checkHealth(options)
  const dlq = getDeadLetterQueue().list()

  return {
    ts: new Date().toISOString(),
    liveness: liveness.status,
    readiness: readiness.status,
    health: health.status,
    metrics,
    deadLetterCount: dlq.length,
    circuitBreakersOpen: options.circuitBreakersOpen ?? countOpenCircuits(metrics),
    memoryPressure: mapMemoryPressure(),
    slowRequestCount: sumCounter(metrics, 'ops.slow_requests'),
    providerFallbackCount: sumCounter(metrics, 'provider.fallback'),
    providerFailureCount: sumCounter(metrics, 'provider.failures'),
    bookingFailureCount: sumCounter(metrics, 'booking.lifecycle_failures'),
    paymentMockFailureCount: sumCounter(metrics, 'payment.mock_failures'),
    ticketingFailureCount: sumCounter(metrics, 'ticketing.failures'),
    notificationFailureCount: sumCounter(metrics, 'notification.failures'),
    authFailureCount: sumCounter(metrics, 'auth.failures'),
    frontendErrorCount: sumCounter(metrics, 'frontend.errors'),
    databaseErrorCount: sumCounter(metrics, 'database.errors'),
    edgeFunctionFailureCount: sumCounter(metrics, 'edge.function_failures'),
    queueBacklog: options.queueBacklog ?? sumCounter(metrics, 'ops.queue_backlog'),
    secretValidationFailureCount: sumCounter(metrics, 'ops.secret_validation_failures'),
  }
}

export function recordFrontendError(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('frontend.errors', tags)
}

export function recordAuthFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('auth.failures', tags)
}

export function recordDatabaseError(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('database.errors', tags)
}

export function recordEdgeFunctionFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('edge.function_failures', tags)
}

export function recordBookingFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('booking.lifecycle_failures', tags)
}

export function recordPaymentMockFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('payment.mock_failures', tags)
}

export function recordTicketingFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('ticketing.failures', tags)
}

export function recordNotificationFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('notification.failures', tags)
}

export function recordSlowRequest(durationMs: number, tags: Record<string, string> = {}): void {
  getOpsMetrics().observe('ops.slow_requests', durationMs, tags)
}

export function recordQueueBacklog(size: number, tags: Record<string, string> = {}): void {
  getOpsMetrics().gauge('ops.queue_backlog', size, tags)
}

export function recordSecretValidationFailure(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('ops.secret_validation_failures', tags)
}

export function recordAppUnavailable(tags: Record<string, string> = {}): void {
  getOpsMetrics().incr('app.unavailable', tags)
}
