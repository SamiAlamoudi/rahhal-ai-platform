/**
 * Sprint 46 — Smart Clarification / Never-Ask-Twice.
 * Soft preferences are inferred; only hard requirements block planning.
 */

export {
  HARD_CLARIFICATION_FIELDS,
  SOFT_CLARIFICATION_FIELDS,
  inferSoftRequirements,
  missingClarificationFields,
  hasApproximateTravelDates,
  type ClarificationInference,
} from './smartClarification'
export { isSmartClarificationEnabled } from './feature'
