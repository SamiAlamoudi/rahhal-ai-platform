/**
 * Sprint 65 — Production Hardening & Go Live contracts.
 * Composes existing ops libraries — no architecture rewrite.
 */

export type ProductionSeverity = 'info' | 'warn' | 'error' | 'critical'

export type ProductionCheckStatus = 'pass' | 'warn' | 'fail' | 'skip'

export interface ProductionCheckResult {
  id: string
  area: string
  status: ProductionCheckStatus
  summary: string
  details?: Record<string, unknown>
}

export interface SecurityFinding {
  id: string
  area: string
  severity: ProductionSeverity
  title: string
  detail: string
  recommendation: string
  status: 'ok' | 'risk' | 'mitigated'
}

export interface SecurityAuditReport {
  generatedAt: string
  findings: SecurityFinding[]
  ok: boolean
  riskCount: number
  mitigatedCount: number
}

export interface FeatureFlagAuditItem {
  id: string
  enabled: boolean
  lifecycle: string
  dependsOn: string[]
  safeDefault: boolean
  notes: string
  risk: ProductionSeverity | 'none'
}

export interface FeatureFlagAuditReport {
  generatedAt: string
  total: number
  enabledCount: number
  disabledCount: number
  riskyEnabled: FeatureFlagAuditItem[]
  items: FeatureFlagAuditItem[]
  ok: boolean
}

export interface ConfigAuditReport {
  generatedAt: string
  target: 'development' | 'staging' | 'production' | 'preview'
  ok: boolean
  errors: string[]
  warnings: string[]
  resolved: Record<string, string | boolean | null>
}

export interface IntegrityIssue {
  code: string
  severity: ProductionSeverity
  message: string
  subjectId?: string | null
}

export interface IntegrityReport {
  ok: boolean
  issues: IntegrityIssue[]
  checkedAt: string
}

export type RecoveryStrategyId =
  | 'retry_with_budget'
  | 'circuit_open_fallback'
  | 'provider_unavailable_degrade'
  | 'provider_degraded_cache'
  | 'partial_booking_rollback'
  | 'booking_session_resume'
  | 'document_regenerate'
  | 'trip_repair'
  | 'dead_letter_enqueue'
  | 'graceful_degrade'

export interface RecoveryAction {
  strategy: RecoveryStrategyId
  applied: boolean
  detail: string
}

export interface RecoveryPlan {
  scenario: string
  actions: RecoveryAction[]
  recoverable: boolean
}

export type DomainTimerName =
  | 'conversation'
  | 'brain'
  | 'trip'
  | 'booking'
  | 'document'
  | 'provider'
  | 'search'
  | 'ranking'
  | 'timeline'

export interface ProductionReadinessReport {
  generatedAt: string
  version: string
  productionReady: boolean
  security: SecurityAuditReport
  featureFlags: FeatureFlagAuditReport
  config: ConfigAuditReport
  integrity: IntegrityReport
  health: {
    liveness: string
    readiness: string
    health: string
  }
  checks: ProductionCheckResult[]
  knownLimitations: string[]
  checklist: Array<{ id: string; label: string; done: boolean }>
}
