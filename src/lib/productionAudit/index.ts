/**
 * Sprint 17 — Production Readiness Audit barrel (audit-only).
 */

export { PRODUCTION_AUDIT_VERSION } from './types'
export type {
  AuditFinding,
  AuditStatus,
  DimensionScore,
  ProductionAuditReport,
  ReleaseScorecard,
} from './types'

export {
  PRODUCTION_AUDIT_PLATFORM_FEATURE_ID,
  isProductionAuditPlatformEnabled,
} from './feature'

export {
  PRODUCTION_CHECKLIST_KEYS,
  buildChecklist,
  type ProductionChecklistKey,
} from './checklist'

export { buildScorecard } from './scorecard'

export {
  ProductionReadinessAuditor,
  createProductionReadinessAuditor,
  CRITICAL_OFF_FLAGS,
  SPRINT17_AUDIT_EVIDENCE,
  type AuditorEvidence,
} from './auditor'
