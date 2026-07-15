/**
 * Phase AA — patch-release eligibility and rollback decision logic.
 */

import type { AlertEvent, AlertSeverity } from '../alerting/types'
import type { MonitoringSnapshot } from '../observability/monitoring'
import type { IncidentRecord } from '../incidents/types'

export type ReleaseAction =
  | 'no_action_monitoring'
  | 'v1.0.1_patch'
  | 'emergency_hotfix'
  | 'rollback'

export interface PatchReleaseDecision {
  action: ReleaseAction
  rationale: string
  severity: AlertSeverity | null
  openIncidentCount: number
}

export interface PatchReleaseInput {
  snapshot: MonitoringSnapshot
  alerts: AlertEvent[]
  openIncidents?: IncidentRecord[]
  appVersion?: string
}

export function evaluatePatchRelease(input: PatchReleaseInput): PatchReleaseDecision {
  const openIncidents = input.openIncidents ?? []
  const criticalAlerts = input.alerts.filter((a) => a.severity === 'critical')
  const highAlerts = input.alerts.filter((a) => a.severity === 'high')

  if (
    input.snapshot.liveness === 'fail'
    || input.snapshot.readiness === 'fail'
    || criticalAlerts.some((a) => a.conditionId === 'application_unavailable')
    || criticalAlerts.some((a) => a.conditionId === 'security_secret_validation_failure')
  ) {
    return {
      action: 'rollback',
      rationale: 'Critical availability or security failure requires rollback.',
      severity: 'critical',
      openIncidentCount: openIncidents.length,
    }
  }

  if (
    criticalAlerts.length > 0
    || openIncidents.some((i) => i.severity === 'critical' && i.status !== 'closed')
  ) {
    return {
      action: 'emergency_hotfix',
      rationale: 'Open critical incident or alert requires emergency hotfix.',
      severity: 'critical',
      openIncidentCount: openIncidents.length,
    }
  }

  if (
    highAlerts.length > 0
    || input.snapshot.bookingFailureCount >= 3
    || input.snapshot.paymentMockFailureCount >= 3
    || input.snapshot.ticketingFailureCount >= 3
    || openIncidents.some((i) => i.severity === 'high')
  ) {
    return {
      action: 'v1.0.1_patch',
      rationale: 'Elevated operational failures warrant a patch release.',
      severity: 'high',
      openIncidentCount: openIncidents.length,
    }
  }

  if (input.alerts.length > 0 || openIncidents.length > 0) {
    return {
      action: 'no_action_monitoring',
      rationale: 'Non-critical signals present; continue monitoring.',
      severity: input.alerts[0]?.severity ?? 'medium',
      openIncidentCount: openIncidents.length,
    }
  }

  return {
    action: 'no_action_monitoring',
    rationale: 'No actionable alerts or open incidents.',
    severity: null,
    openIncidentCount: 0,
  }
}

export function shouldRollback(snapshot: MonitoringSnapshot, alerts: AlertEvent[]): boolean {
  return evaluatePatchRelease({ snapshot, alerts }).action === 'rollback'
}

export function isPatchEligible(snapshot: MonitoringSnapshot, alerts: AlertEvent[]): boolean {
  const action = evaluatePatchRelease({ snapshot, alerts }).action
  return action === 'v1.0.1_patch' || action === 'emergency_hotfix'
}
