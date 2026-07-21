/**
 * Sprint 69 — Operational reports (daily / weekly / domain).
 */

import { collectProductionMetrics } from '../deployment'
import { collectMonitoringSnapshot } from '../observability/monitoring'
import { buildProductionOpsDashboard } from './dashboards'
import { collectProviderMonitorMetrics } from './providerMonitoring'
import type { OperationalReport, OpsEnvironment, OpsReportKind } from './types'

export function generateOperationalReport(
  kind: OpsReportKind,
  environment: OpsEnvironment = 'beta',
): OperationalReport {
  const metrics = collectProductionMetrics()
  const monitoring = collectMonitoringSnapshot()
  const dashboard = buildProductionOpsDashboard(environment)
  const providers = collectProviderMonitorMetrics(environment)
  const now = new Date().toISOString()

  switch (kind) {
    case 'daily':
      return {
        kind,
        title: 'Daily Operations Report',
        summary: `overall=${dashboard.overall}; errors=${monitoring.frontendErrorCount}`,
        metrics: {
          overall: dashboard.overall,
          bookingFailures: monitoring.bookingFailureCount,
          providerFailures: monitoring.providerFailureCount,
          avgSearchMs: metrics.searchLatencyMs,
        },
        generatedAt: now,
      }
    case 'weekly':
      return {
        kind,
        title: 'Weekly Operations Report',
        summary: `Weekly rollup — system=${dashboard.system.status}`,
        metrics: {
          errorRate: metrics.errorRate,
          retryRate: metrics.retryRate,
          timeouts: metrics.timeoutCount,
        },
        generatedAt: now,
      }
    case 'provider':
      return {
        kind,
        title: 'Provider Report',
        summary: `providers=${providers.length}`,
        metrics: Object.fromEntries(
          providers.map((p) => [p.providerId, p.successRate]),
        ),
        generatedAt: now,
      }
    case 'booking':
      return {
        kind,
        title: 'Booking Report',
        summary: `booking latency=${metrics.bookingLatencyMs}ms`,
        metrics: {
          latencyMs: metrics.bookingLatencyMs,
          failures: monitoring.bookingFailureCount,
        },
        generatedAt: now,
      }
    case 'conversation':
      return {
        kind,
        title: 'Conversation Report',
        summary: `conversation latency=${metrics.conversationLatencyMs}ms`,
        metrics: { latencyMs: metrics.conversationLatencyMs },
        generatedAt: now,
      }
    case 'trip':
      return {
        kind,
        title: 'Trip Report',
        summary: `trip latency=${metrics.tripLatencyMs}ms`,
        metrics: { latencyMs: metrics.tripLatencyMs },
        generatedAt: now,
      }
    case 'revenue':
      return {
        kind,
        title: 'Revenue Report',
        summary: 'Mock payments — revenue tracking informational only',
        metrics: {
          paymentMockFailures: monitoring.paymentMockFailureCount,
          mode: 'mock',
        },
        generatedAt: now,
      }
    case 'system':
    default:
      return {
        kind: 'system',
        title: 'System Report',
        summary: `health=${monitoring.health} readiness=${monitoring.readiness}`,
        metrics: {
          health: monitoring.health,
          readiness: monitoring.readiness,
          liveness: monitoring.liveness,
          memoryPressure: metrics.memoryPressure,
        },
        generatedAt: now,
      }
  }
}

export function generateAllOperationalReports(
  environment: OpsEnvironment = 'beta',
): OperationalReport[] {
  const kinds: OpsReportKind[] = [
    'daily',
    'weekly',
    'provider',
    'booking',
    'conversation',
    'trip',
    'revenue',
    'system',
  ]
  return kinds.map((k) => generateOperationalReport(k, environment))
}
