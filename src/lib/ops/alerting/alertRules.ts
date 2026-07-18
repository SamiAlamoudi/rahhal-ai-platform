/**
 * Phase AA — alert rule definitions and severity mapping.
 */

import type { MonitoringSnapshot } from '../observability/monitoring'
import type { AlertConditionId, AlertEvent, AlertSeverity } from './types'

export interface AlertRule {
  id: AlertConditionId
  severity: AlertSeverity
  title: string
  evaluate(snapshot: MonitoringSnapshot): boolean
  message(snapshot: MonitoringSnapshot): string
  affectedServices(snapshot: MonitoringSnapshot): string[]
}

export const ALERT_SEVERITY_ORDER: AlertSeverity[] = ['critical', 'high', 'medium', 'low']

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'application_unavailable',
    severity: 'critical',
    title: 'Application unavailable',
    evaluate: (s) => s.liveness === 'fail' || s.health === 'fail',
    message: (s) => `Health=${s.health}, liveness=${s.liveness}`,
    affectedServices: () => ['spa'],
  },
  {
    id: 'readiness_failure',
    severity: 'critical',
    title: 'Readiness probe failed',
    evaluate: (s) => s.readiness === 'fail',
    message: (s) => `Readiness=${s.readiness}`,
    affectedServices: () => ['spa', 'edge_functions'],
  },
  {
    id: 'elevated_error_rate',
    severity: 'high',
    title: 'Elevated frontend error rate',
    evaluate: (s) => s.frontendErrorCount >= 10,
    message: (s) => `frontend.errors=${s.frontendErrorCount}`,
    affectedServices: () => ['spa'],
  },
  {
    id: 'repeated_auth_failures',
    severity: 'high',
    title: 'Repeated authentication failures',
    evaluate: (s) => s.authFailureCount >= 5,
    message: (s) => `auth.failures=${s.authFailureCount}`,
    affectedServices: () => ['auth'],
  },
  {
    id: 'provider_outage',
    severity: 'high',
    title: 'Provider outage or circuit open',
    evaluate: (s) => s.providerFailureCount >= 5 || s.circuitBreakersOpen >= 1,
    message: (s) => `provider.failures=${s.providerFailureCount}, circuits_open=${s.circuitBreakersOpen}`,
    affectedServices: () => ['providers'],
  },
  {
    id: 'database_connection_failure',
    severity: 'critical',
    title: 'Database errors detected',
    evaluate: (s) => s.databaseErrorCount >= 3,
    message: (s) => `database.errors=${s.databaseErrorCount}`,
    affectedServices: () => ['database'],
  },
  {
    id: 'queue_backlog',
    severity: 'medium',
    title: 'Queue backlog growing',
    evaluate: (s) => s.queueBacklog >= 25,
    message: (s) => `queue_backlog=${s.queueBacklog}`,
    affectedServices: () => ['queue'],
  },
  {
    id: 'dead_letter_growth',
    severity: 'medium',
    title: 'Dead-letter queue growth',
    evaluate: (s) => s.deadLetterCount >= 5,
    message: (s) => `dlq_items=${s.deadLetterCount}`,
    affectedServices: () => ['queue', 'notifications'],
  },
  {
    id: 'booking_ticketing_spike',
    severity: 'high',
    title: 'Booking or ticketing failure spike',
    evaluate: (s) => s.bookingFailureCount >= 3 || s.ticketingFailureCount >= 3,
    message: (s) => `booking=${s.bookingFailureCount}, ticketing=${s.ticketingFailureCount}`,
    affectedServices: () => ['booking', 'ticketing', 'payment'],
  },
  {
    id: 'security_secret_validation_failure',
    severity: 'critical',
    title: 'Security or secret validation failure',
    evaluate: (s) => s.secretValidationFailureCount >= 1,
    message: (s) => `secret_validation_failures=${s.secretValidationFailureCount}`,
    affectedServices: () => ['spa', 'edge_functions'],
  },
]

export function evaluateAlertRules(
  snapshot: MonitoringSnapshot,
  rules: AlertRule[] = DEFAULT_ALERT_RULES,
): AlertEvent[] {
  const fired: AlertEvent[] = []
  for (const rule of rules) {
    if (!rule.evaluate(snapshot)) continue
    fired.push({
      id: `alert_${rule.id}_${snapshot.ts}`,
      conditionId: rule.id,
      severity: rule.severity,
      title: rule.title,
      message: rule.message(snapshot),
      firedAt: snapshot.ts,
      affectedServices: rule.affectedServices(snapshot),
      metadata: {
        health: snapshot.health,
        readiness: snapshot.readiness,
        liveness: snapshot.liveness,
      },
    })
  }
  return fired
}

export function highestSeverity(alerts: AlertEvent[]): AlertSeverity | null {
  if (!alerts.length) return null
  for (const level of ALERT_SEVERITY_ORDER) {
    if (alerts.some((a) => a.severity === level)) return level
  }
  return alerts[0]?.severity ?? null
}
