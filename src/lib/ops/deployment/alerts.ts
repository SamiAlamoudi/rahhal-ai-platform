/**
 * Sprint 68 — Production alert evaluation for launch automation.
 */

import { DEFAULT_ALERT_RULES, evaluateAlertRules } from '../alerting'
import { collectMonitoringSnapshot } from '../observability/monitoring'
import type { AlertEvaluationReport } from './types'

export function evaluateProductionAlerts(input?: {
  now?: () => number
}): AlertEvaluationReport {
  const now = input?.now ?? (() => Date.now())
  const snapshot = collectMonitoringSnapshot()
  const alerts = evaluateAlertRules(snapshot, DEFAULT_ALERT_RULES)
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const highCount = alerts.filter((a) => a.severity === 'high').length

  return {
    ok: criticalCount === 0,
    alertCount: alerts.length,
    criticalCount,
    highCount,
    alerts: alerts.map((a) => ({
      id: a.conditionId,
      severity: a.severity,
      title: a.title,
      message: a.message,
    })),
    generatedAt: new Date(now()).toISOString(),
  }
}

/** Named production failure classes for documentation / checklist. */
export const PRODUCTION_ALERT_CLASSES = [
  'Provider failures',
  'Payment failures',
  'Booking failures',
  'Search failures',
  'High latency',
  'Timeouts',
  'Authentication failures',
  'Rate limits',
  'Critical production failures',
] as const
