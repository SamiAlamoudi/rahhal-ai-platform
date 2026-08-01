/**
 * Sprint 89 Phase 2 — planning facade exports.
 * T2–T9: … → PlanningHints → PlanningAdapter → DecisionContract (compile-only).
 * No BrainRouter / CM runtime wiring.
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

export {
  CLARIFICATION_BRIDGE_VERSION,
  CLARIFICATION_MERGE_GROUPS,
  ClarificationBridge,
  createClarificationBridge,
  planClarification,
  mergeClarificationFields,
  type ClarificationAvoidReasonCode,
  type ClarificationAvoidReason,
  type ClarificationQuestionCandidatePlan,
  type ClarificationPlanningHints,
  type ClarificationCmInjectionDesign,
  type ClarificationBridgeInput,
  type ClarificationBridgeResult,
} from './ClarificationBridge'

export {
  TOOL_DECISION_BRIDGE_VERSION,
  ToolDecisionBridge,
  createToolDecisionBridge,
  decideToolDecision,
  assertSearchEligibleInvariant,
  type ToolDecision,
  type ToolDecisionReasonCode,
  type SearchHandoffMeta,
  type ToolDecisionBridgeInput,
  type ToolDecisionResult,
} from './ToolDecisionBridge'

export {
  PLANNING_HINTS_BUILDER_VERSION,
  PlanningHintsBuilder,
  createPlanningHintsBuilder,
  buildPlanningHints,
  assertPlanningHintsInvariants,
  type NextPlannerAction,
  type PlanningHintsAssumption,
  type PlanningHintsConfidence,
  type PlanningHintsReasoning,
  type PlanningHints,
  type PlanningHintsBuilderInput,
} from './PlanningHintsBuilder'

export {
  BRAIN_ROUTER_PLANNING_ADAPTER_VERSION,
  BrainRouterPlanningAdapter,
  createBrainRouterPlanningAdapter,
  adaptPlanningHintsForBrainRouter,
  assertBrainRouterPlanningInvariants,
  type BrainRouterClarificationSlice,
  type BrainRouterPlanningResult,
  type BrainRouterPlanningAdapterInput,
} from './BrainRouterPlanningAdapter'

export {
  BRAIN_ROUTER_DECISION_CONTRACT_VERSION,
  BrainRouterDecisionContractBuilder,
  createBrainRouterDecisionContractBuilder,
  buildBrainRouterDecisionContract,
  assertBrainRouterDecisionContractInvariants,
  type BrainRouterDecisionPayload,
  type BrainRouterDecisionCapabilities,
  type BrainRouterDecisionContract,
  type BrainRouterDecisionContractInput,
} from './BrainRouterDecisionContract'
