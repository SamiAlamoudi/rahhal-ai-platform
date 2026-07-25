/**
 * Evolution Sprint 4 — Planning Graph Layer (additive).
 * Default OFF via `ai.planning_graph`. Not wired into planTurn.
 */

export type {
  PlanningLocale,
  PlanNodeStatus,
  GraphEdgeKind,
  PlanBudgetSnapshot,
  PlanDatesSnapshot,
  PlanTravelerProfileSnapshot,
  PlanNodeData,
  PlanVersionRecord,
  ScenarioBranchRecord,
  DecisionForkRecord,
  GraphEdge,
  PlanComparisonResult,
  MergeCandidate,
  DiscardCandidate,
  BestPlanSelection,
  PlanningGraphState,
  CreatePlanInput,
} from './planningGraphTypes'

export {
  isoNow,
  newId,
  clamp01,
  clampScore,
  uniqueStrings,
  emptyProfile,
  emptyConstraints,
  emptyBudget,
  emptyDates,
} from './planningGraphTypes'

export {
  PLANNING_GRAPH_FEATURE_ID,
  isPlanningGraphEnabled,
} from './planningGraphFeature'

export { PlanNode, createPlanNode, clonePlanNodeData, scorePlanNode } from './planNode'
export { ScenarioBranch, createScenarioBranch, appendNodeToBranch } from './scenarioBranch'
export { AlternativePlan, toAlternativePlan, listAlternatives } from './alternativePlan'
export { PlanVersion, recordPlanVersion, versionsForNode } from './planVersion'
export { DecisionFork, createDecisionFork } from './decisionFork'
export {
  ConstraintPropagation,
  propagateConstraints,
  constraintConflicts,
} from './constraintPropagation'
export {
  PreferencePropagation,
  propagatePreferences,
  propagateConfidence,
} from './preferencePropagation'
export { PlanComparison, comparePlans } from './planComparison'
export { MergeCandidates, findMergeCandidates } from './mergeCandidates'
export { DiscardCandidates, findDiscardCandidates } from './discardCandidates'
export { BestPlanSelector, selectBestPlan } from './bestPlanSelector'

export {
  PlanningGraph,
  createPlanningGraph,
  tryCreatePlanningGraph,
  addRootPlan,
  branchPlan,
  mergePlans,
  compareGraphPlans,
  rejectPlan,
  restorePlan,
  clonePlan,
  scorePlan,
  selectBest,
  mergeCandidateList,
  discardCandidateList,
  alternativeList,
  listGraphNodes,
  getRejectedPlans,
} from './planningGraph'
