/**
 * RC2 — GA Review barrel (additive; flag OFF by default).
 */

export { RC2_GA_REVIEW_VERSION } from './types'
export type {
  ChecklistItem,
  ChecklistStatus,
  DocumentationIndexEntry,
  FeatureFlagStatusRow,
  GoNoGoDecision,
  GoNoGoReport,
  MergeStackEntry,
  Rc2Evidence,
  Rc2GaReviewReport,
} from './types'

export {
  RC2_GA_REVIEW_FEATURE_ID,
  isRc2GaReviewEnabled,
} from './feature'

export {
  PRODUCTION_READINESS_MERGE_ORDER,
  PARALLEL_INTEGRATION_DRAFTS,
  validateMergeOrder,
} from './mergeOrder'

export { RC2_MUST_STAY_OFF, reviewFeatureFlags } from './featureFlagReview'
export { DOCUMENTATION_INDEX, buildDocumentationIndex } from './documentationIndex'
export { buildMasterChecklist } from './checklist'
export { decideGoNoGo } from './goNoGo'
export {
  Rc2GaReviewer,
  createRc2GaReviewer,
  RC2_GA_EVIDENCE,
} from './Rc2GaReviewer'
