/**
 * Sprint 18 — Release Candidate (RC1) validation contracts.
 */

export const RC1_VALIDATION_VERSION = '1.0.0-rc1-validation'

export type ValidationStatus = 'pass' | 'warn' | 'fail' | 'skip'

export type GoNoGoDecision = 'GO' | 'GO_WITH_CONDITIONS' | 'NO_GO'

export interface ValidationCheck {
  id: string
  area: string
  status: ValidationStatus
  summary: string
  detail?: string
}

export interface JourneyStageHandoffResult {
  stage: string
  previousStage: string | null
  handedOff: boolean
  note: string
}

export interface FeatureFlagMatrixRow {
  id: string
  lifecycle: string
  defaultEnabled: boolean
  offOk: boolean
  onOk: boolean
  dependencyOk: boolean
  crossLeakOk: boolean
}

export interface ProviderValidationRow {
  provider: string
  adapter: string
  status: ValidationStatus
  fallbackOk: boolean
  note: string
}

export interface GoNoGoReport {
  decision: GoNoGoDecision
  rationale: string
  blockers: string[]
  conditions: string[]
  checks: ValidationCheck[]
  generatedAt: string
  version: string
}

export interface Rc1ValidationReport {
  version: string
  generatedAt: string
  journeyHandoffs: JourneyStageHandoffResult[]
  featureFlagMatrix: FeatureFlagMatrixRow[]
  providers: ProviderValidationRow[]
  checks: ValidationCheck[]
  goNoGo: GoNoGoReport
}
