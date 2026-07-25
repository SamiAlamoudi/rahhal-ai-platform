/**
 * RC2 — General Availability (GA) final release review contracts.
 */

export const RC2_GA_REVIEW_VERSION = '1.0.0-rc2-ga-review'

export type ChecklistStatus = 'PASS' | 'WARNING' | 'BLOCKER'

export type GoNoGoDecision = 'GO' | 'GO_WITH_CONDITIONS' | 'NO_GO'

export interface ChecklistItem {
  id: string
  area: string
  status: ChecklistStatus
  summary: string
  detail?: string
}

export interface MergeStackEntry {
  order: number
  pr: number
  title: string
  branch: string
  base: string
  role: string
}

export interface FeatureFlagStatusRow {
  id: string
  defaultEnabled: boolean
  lifecycle: string
  mustStayOff: boolean
  ownership: string
  rollback: string
  notes: string
}

export interface DocumentationIndexEntry {
  category: string
  path: string
  exists: boolean
}

export interface GoNoGoReport {
  decision: GoNoGoDecision
  rationale: string
  blockers: string[]
  conditions: string[]
  generatedAt: string
  version: string
}

export interface Rc2Evidence {
  typecheckPass?: boolean
  lintPass?: boolean
  archCircularPass?: boolean
  buildPass?: boolean
  testsPassed?: number
  securityGatePass?: boolean
  dependencyAuditHighCount?: number
  chatPageBundleKb?: number
  baselineChatPageKb?: number
  lazyLoadingPresent?: boolean
  memoryLeakFree?: boolean
  soakSessionsCompleted?: number
  concurrencyMax?: number
  readinessOverall?: number
}

export interface Rc2GaReviewReport {
  version: string
  generatedAt: string
  mergeOrder: MergeStackEntry[]
  featureFlags: FeatureFlagStatusRow[]
  checklist: ChecklistItem[]
  documentationIndex: DocumentationIndexEntry[]
  goNoGo: GoNoGoReport
  readinessOverall: number
}
