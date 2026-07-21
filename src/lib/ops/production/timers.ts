/**
 * Sprint 65 — Domain performance timers → ops metrics.
 */

import { getCorrelationId } from '../logging/correlation'
import { getLogger } from '../logging/structuredLogger'
import { getOpsMetrics, type OpsMetricName } from '../observability/metricsRegistry'
import type { DomainTimerName } from './types'

const METRIC_FOR_DOMAIN: Record<DomainTimerName, OpsMetricName> = {
  conversation: 'conversation.latency_ms',
  brain: 'conversation.latency_ms',
  trip: 'trip.latency_ms',
  booking: 'booking.latency_ms',
  document: 'document.latency_ms',
  provider: 'provider.latency_ms',
  search: 'provider.latency_ms',
  ranking: 'provider.latency_ms',
  timeline: 'trip.latency_ms',
}

const COUNT_FOR_DOMAIN: Partial<Record<DomainTimerName, OpsMetricName>> = {
  conversation: 'conversation.count',
  trip: 'trip.count',
  document: 'document.count',
}

export function timeDomain<T>(
  domain: DomainTimerName,
  operation: string,
  fn: () => T,
  tags: Record<string, string> = {},
): T {
  const started = Date.now()
  try {
    const result = fn()
    recordDomainTiming(domain, operation, Date.now() - started, tags, true)
    return result
  } catch (err) {
    recordDomainTiming(domain, operation, Date.now() - started, tags, false)
    throw err
  }
}

export async function timeDomainAsync<T>(
  domain: DomainTimerName,
  operation: string,
  fn: () => Promise<T>,
  tags: Record<string, string> = {},
): Promise<T> {
  const started = Date.now()
  try {
    const result = await fn()
    recordDomainTiming(domain, operation, Date.now() - started, tags, true)
    return result
  } catch (err) {
    recordDomainTiming(domain, operation, Date.now() - started, tags, false)
    throw err
  }
}

export function recordDomainTiming(
  domain: DomainTimerName,
  operation: string,
  durationMs: number,
  tags: Record<string, string> = {},
  ok = true,
): void {
  const metrics = getOpsMetrics()
  const metric = METRIC_FOR_DOMAIN[domain]
  metrics.observe(metric, durationMs, { domain, operation, ...tags })
  const countMetric = COUNT_FOR_DOMAIN[domain]
  if (countMetric) metrics.incr(countMetric, { domain, operation })
  if (!ok) metrics.incr('ops.errors', { domain, operation })
  if (durationMs >= 2000) metrics.incr('ops.slow_requests', { domain, operation })

  getLogger().info('perf', operation, 'domain_timing', {
    domain,
    durationMs,
    ok,
    correlationId: getCorrelationId(),
    ...tags,
  })
}

export function recordRetry(domain: string, operation: string): void {
  getOpsMetrics().incr('ops.retries', { domain, operation })
}

export function recordTimeout(domain: string, operation: string): void {
  getOpsMetrics().incr('ops.timeouts', { domain, operation })
}

export function recordCacheHit(domain: string): void {
  getOpsMetrics().incr('ops.cache_hits', { domain })
}

export function recordCacheMiss(domain: string): void {
  getOpsMetrics().incr('ops.cache_misses', { domain })
}

export function recordWarning(domain: string, code: string): void {
  getOpsMetrics().incr('ops.warnings', { domain, code })
}
