/**
 * Sprint 17 — Production Readiness Audit contracts (audit-only; no product features).
 */

export const PRODUCTION_AUDIT_VERSION = '1.0.0-production-readiness-audit'

export type AuditStatus = 'pass' | 'warn' | 'fail' | 'info'

export interface AuditFinding {
  id: string
  area: string
  status: AuditStatus
  summary: string
  detail?: string
  scoreImpact?: number
}

export interface DimensionScore {
  dimension: string
  score: number
  weight: number
  notes: string
}

export interface ReleaseScorecard {
  version: string
  generatedAt: string
  dimensions: DimensionScore[]
  overall: number
  productionReady: boolean
  blockers: string[]
  recommendations: string[]
}

export interface ProductionAuditReport {
  version: string
  generatedAt: string
  findings: AuditFinding[]
  scorecard: ReleaseScorecard
  checklist: Record<string, AuditStatus>
}
