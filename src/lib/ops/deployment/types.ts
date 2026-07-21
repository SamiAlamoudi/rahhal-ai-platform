/**
 * Sprint 68 — Production Deployment & Launch Automation types.
 */

export type DeployProfileName = 'development' | 'staging' | 'beta' | 'production'

export type GateStatus = 'pass' | 'warn' | 'fail' | 'skip'

export type ChecklistItemStatus = 'done' | 'pending' | 'blocked'

export interface DeployProfile {
  name: DeployProfileName
  label: string
  /** Maps onto existing DeployTarget for env validation. */
  envTarget: 'development' | 'preview' | 'staging' | 'production'
  requireMockPayments: boolean
  allowLiveProviders: boolean
  requireSupabase: boolean
  failFastOnInvalidEnv: boolean
  description: string
}

export interface SecretCheckItem {
  id: string
  category:
    | 'api_keys'
    | 'amadeus'
    | 'booking_com'
    | 'duffel'
    | 'stripe'
    | 'hyperpay'
    | 'apple_pay'
    | 'email'
    | 'whatsapp'
    | 'push'
    | 'environment'
  label: string
  status: 'ok' | 'missing' | 'invalid' | 'forbidden' | 'optional' | 'warn'
  detail: string
  clientExposed: boolean
}

export interface SecretValidationReport {
  ok: boolean
  profile: DeployProfileName
  items: SecretCheckItem[]
  missing: string[]
  invalid: string[]
  forbidden: string[]
  warnings: string[]
  generatedAt: string
}

export interface SubsystemHealth {
  id: string
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  latencyMs?: number
  detail?: string
}

export interface ProductionHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  liveness: 'ok' | 'degraded' | 'fail'
  readiness: 'ok' | 'degraded' | 'fail'
  health: 'ok' | 'degraded' | 'fail'
  subsystems: SubsystemHealth[]
  generatedAt: string
}

export interface ProductionMetricsSnapshot {
  conversationLatencyMs: number
  searchLatencyMs: number
  bookingLatencyMs: number
  providerLatencyMs: number
  tripLatencyMs: number
  documentLatencyMs: number
  paymentLatencyMs: number
  errorRate: number
  retryRate: number
  timeoutCount: number
  memoryPressure: 'low' | 'medium' | 'high' | 'unknown'
  cpuPressure: 'low' | 'medium' | 'high' | 'unknown'
  generatedAt: string
}

export type RollbackKind =
  | 'deployment'
  | 'configuration'
  | 'provider'
  | 'feature'
  | 'startup_recovery'
  | 'safe_mode'

export interface RollbackStep {
  id: string
  kind: RollbackKind
  action: string
  automatic: boolean
  priority: number
}

export interface RollbackPlan {
  recommended: boolean
  reason: string
  safeMode: boolean
  steps: RollbackStep[]
  releaseAction: string
  generatedAt: string
}

export interface AlertEvaluationReport {
  ok: boolean
  alertCount: number
  criticalCount: number
  highCount: number
  alerts: Array<{
    id: string
    severity: string
    title: string
    message: string
  }>
  generatedAt: string
}

export interface CICDGate {
  id: string
  label: string
  status: GateStatus
  detail: string
}

export interface CICDPipelineReport {
  ok: boolean
  gates: CICDGate[]
  rollbackTrigger: boolean
  generatedAt: string
}

export interface GoLiveChecklistItem {
  id: string
  label: string
  status: ChecklistItemStatus
  group: string
}

export interface FeatureMatrixEntry {
  id: string
  enabled: boolean
  lifecycle: string
  productionSafe: boolean
}

export interface ReleaseAutomationArtifacts {
  version: string
  rcVersion: string
  packageVersion: string
  releaseNotes: string
  deploymentReport: string
  environmentReport: string
  featureMatrix: FeatureMatrixEntry[]
  knownLimitations: string[]
  rollbackGuide: string
  goLiveChecklist: GoLiveChecklistItem[]
  versionReport: string
}

export interface ProductionValidationGate {
  id: string
  label: string
  ok: boolean
  detail: string
}

export interface DeploymentLaunchReport {
  ok: boolean
  productionReady: boolean
  readinessScore: number
  version: string
  profile: DeployProfileName
  cicd: CICDPipelineReport
  secrets: SecretValidationReport
  health: ProductionHealthReport
  metrics: ProductionMetricsSnapshot
  alerts: AlertEvaluationReport
  rollback: RollbackPlan
  validationGates: ProductionValidationGate[]
  artifacts: ReleaseAutomationArtifacts
  checklist: GoLiveChecklistItem[]
  summary: string
  generatedAt: string
}
