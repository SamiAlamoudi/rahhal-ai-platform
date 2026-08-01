/**
 * Sprint 89 Phase 2 — planning facade exports.
 * T2: MissingInformationPlanner. T3: AssumptionPolicy.
 * No BrainRouter / CM wiring.
 */

export {
  MISSING_INFORMATION_PLANNER_VERSION,
  BOOKING_ONLY_FIELDS,
  MissingInformationPlanner,
  createMissingInformationPlanner,
  planMissingInformation,
  type MissingInfoGoal,
  type MissingFieldClassification,
  type MissingFieldReasonCode,
  type MissingFieldEntry,
  type ClarificationQuestionCandidate,
  type MissingInformationPlannerInput,
  type MissingInformationResult,
} from './MissingInformationPlanner'

export {
  ASSUMPTION_POLICY_VERSION,
  ASSUMPTION_FORBIDDEN_FIELDS,
  AssumptionPolicy,
  createAssumptionPolicy,
  proposeAssumptions,
  assertAssumptionWritable,
  promoteAssumptionToConfirmed,
  type AssumptionSource,
  type AssumptionReasonCode,
  type AssumptionDecision,
  type AssumptionRejection,
  type AssumptionPolicyInput,
  type AssumptionPolicyResult,
} from './AssumptionPolicy'

export {
  CONFIDENCE_GATES_VERSION,
  CONFIDENCE_SCORE_HIGH,
  CONFIDENCE_SCORE_MEDIUM,
  SEARCH_INFERENCE_ALLOWLIST,
  ConfidenceGates,
  createConfidenceGates,
  evaluateConfidenceGates,
  scoreToConfidenceLevel,
  type ConfidenceLevel,
  type ConfidenceBlockingReason,
  type FieldConfidenceMap,
  type ConfidenceGateInput,
  type ConfidenceDecision,
} from './ConfidenceGates'
