/**
 * Sprint 15 — performance dashboard report builders (in-memory).
 */

import { getAlertEngine } from './alerts'
import { getHealthMonitor } from './HealthMonitor'
import { getMetricsCollector } from './MetricsCollector'
import { getTracer } from './Tracer'
import type { HealthReport, MetricsSnapshot } from './types'

export interface PerformanceSummary {
  generatedAt: string
  metrics: MetricsSnapshot
  latencyBreakdown: Record<string, number>
  providerStatistics: {
    failures: number
    timeouts: number
    failureRate: number
  }
  conversationStatistics: {
    started: number
    completed: number
    completionRate: number
  }
  health: HealthReport
  alertsTriggered: number
}

export function buildPerformanceSummary(): PerformanceSummary {
  const metrics = getMetricsCollector().snapshot()
  const tracer = getTracer()
  const health = getHealthMonitor().report()
  const alerts = getAlertEngine().evaluate().filter((a) => a.triggered)
  const requestCount = Math.max(1, metrics.requestCount)
  return {
    generatedAt: new Date().toISOString(),
    metrics,
    latencyBreakdown: tracer.latencyBreakdown(),
    providerStatistics: {
      failures: metrics.providerFailureCount,
      timeouts: metrics.providerTimeoutCount,
      failureRate: metrics.providerFailureCount / requestCount,
    },
    conversationStatistics: {
      started: metrics.conversationStarted,
      completed: metrics.conversationCompleted,
      completionRate: metrics.conversationCompletionRate,
    },
    health,
    alertsTriggered: alerts.length,
  }
}

export function renderPerformanceDashboardMarkdown(summary?: PerformanceSummary): string {
  const s = summary ?? buildPerformanceSummary()
  const lines = [
    '# Performance Dashboard',
    '',
    `Generated: ${s.generatedAt}`,
    '',
    '## Performance Summary',
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Requests/sec | ${s.metrics.requestsPerSec.toFixed(3)} |`,
    `| Avg latency (ms) | ${s.metrics.averageLatencyMs.toFixed(2)} |`,
    `| P95 (ms) | ${s.metrics.p95LatencyMs.toFixed(2)} |`,
    `| P99 (ms) | ${s.metrics.p99LatencyMs.toFixed(2)} |`,
    `| Cache hit ratio | ${(s.metrics.cacheHitRatio * 100).toFixed(1)}% |`,
    '',
    '## Latency Breakdown',
    '',
    ...Object.entries(s.latencyBreakdown).map(([k, v]) => `- ${k}: ${v.toFixed(2)} ms`),
    '',
    '## Provider Statistics',
    '',
    `- Failures: ${s.providerStatistics.failures}`,
    `- Timeouts: ${s.providerStatistics.timeouts}`,
    `- Failure rate: ${(s.providerStatistics.failureRate * 100).toFixed(2)}%`,
    '',
    '## Conversation Statistics',
    '',
    `- Started: ${s.conversationStatistics.started}`,
    `- Completed: ${s.conversationStatistics.completed}`,
    `- Completion rate: ${(s.conversationStatistics.completionRate * 100).toFixed(1)}%`,
    '',
    '## Health Status',
    '',
    `- Overall: **${s.health.overall}**`,
    ...s.health.checks.map((c) => `- ${c.name}: ${c.status} — ${c.detail}`),
    '',
    `Alerts triggered: ${s.alertsTriggered}`,
    '',
  ]
  return lines.join('\n')
}
