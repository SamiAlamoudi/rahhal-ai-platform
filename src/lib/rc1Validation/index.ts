/**
 * Sprint 18 — RC1 Validation barrel (additive; flag OFF by default).
 */

export { RC1_VALIDATION_VERSION } from './types'
export type {
  FeatureFlagMatrixRow,
  GoNoGoDecision,
  GoNoGoReport,
  JourneyStageHandoffResult,
  ProviderValidationRow,
  Rc1ValidationReport,
  ValidationCheck,
  ValidationStatus,
} from './types'

export {
  RC1_VALIDATION_FEATURE_ID,
  isRc1ValidationEnabled,
} from './feature'

export { RC1_MISSION_STAGES, validateJourneyHandoffs } from './journeyValidation'
export { RC1_MUST_STAY_OFF, buildFeatureFlagMatrix } from './featureFlagMatrix'
export { validateProviders } from './providerValidation'
export { validateRecovery } from './recoveryValidation'
export { validateObservability } from './observabilityValidation'
export { validateSecurity } from './securityValidation'
export { validatePerformance } from './performanceValidation'
export { decideGoNoGo } from './goNoGo'
export {
  Rc1Validator,
  createRc1Validator,
  RC1_SPRINT18_EVIDENCE,
  type Rc1ValidatorEvidence,
} from './Rc1Validator'
