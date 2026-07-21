/**
 * Sprint 66 — End-to-End Production Validation contracts.
 * Orchestration / reporting only — no architecture rewrite.
 */

export type ValidationFlowId =
  | 'flow1_conversation_search_ranking'
  | 'flow2_booking_trip_documents'
  | 'flow3_sync_refresh'
  | 'flow4_cancellation'
  | 'flow5_multi_booking_timeline'
  | 'flow6_provider_failure_recovery'
  | 'flow7_feature_flags'

export type ValidationStepStatus = 'pass' | 'fail' | 'skip' | 'warn'

export interface ValidationStepResult {
  id: string
  label: string
  status: ValidationStepStatus
  detail?: string
  durationMs?: number
}

export interface ValidationFlowResult {
  flowId: ValidationFlowId
  name: string
  ok: boolean
  steps: ValidationStepResult[]
  durationMs: number
  artifacts?: Record<string, unknown>
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface ComponentHealth {
  component: string
  status: HealthStatus
  checks: ValidationStepResult[]
  summary: string
  updatedAt: string
}

export interface ProductionHealthDashboard {
  conversation: ComponentHealth
  provider: ComponentHealth
  booking: ComponentHealth
  trip: ComponentHealth
  document: ComponentHealth
  overall: ComponentHealth
  generatedAt: string
}

export interface SystemReadinessSection {
  id: string
  name: string
  status: HealthStatus
  ok: boolean
  notes: string[]
  metrics?: Record<string, number | string | boolean>
}

export interface SystemReadinessReport {
  generatedAt: string
  version: string
  productionValidated: boolean
  sections: SystemReadinessSection[]
  flows: ValidationFlowResult[]
  dashboard: ProductionHealthDashboard
  summary: {
    flowsPassed: number
    flowsFailed: number
    flowsSkipped: number
    totalSteps: number
    passedSteps: number
  }
}

export const SPRINT66_VALIDATION_VERSION = '1.0.0-e2e'
