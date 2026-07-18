/**
 * Phase AA — alerting types (provider-neutral).
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export type AlertConditionId =
  | 'application_unavailable'
  | 'readiness_failure'
  | 'elevated_error_rate'
  | 'repeated_auth_failures'
  | 'provider_outage'
  | 'database_connection_failure'
  | 'queue_backlog'
  | 'dead_letter_growth'
  | 'booking_ticketing_spike'
  | 'security_secret_validation_failure'

export interface AlertEvent {
  id: string
  conditionId: AlertConditionId
  severity: AlertSeverity
  title: string
  message: string
  firedAt: string
  correlationId?: string | null
  affectedServices: string[]
  metadata: Record<string, unknown>
}

export interface AlertSink {
  dispatch(alert: AlertEvent): void | Promise<void>
}
