/**
 * Evolution Sprint 2 — Consultant Reflection Layer (additive).
 * Default OFF via `ai.consultant_reflection`. Not wired into planTurn.
 */

export type {
  ReasoningNodeId,
  ReflectionSlotKey,
  KnownSlots,
  ConversationTurn,
  TravelerStateSnapshot,
  ConfidencePoint,
  ClarificationItem,
  AssumptionRecord,
  RecommendationRecord,
  DecisionHistoryEntry,
  CachedReasoningNodes,
  ReflectionSession,
  ReflectionTurnInput,
  ReflectionPipelineResult,
} from './reflectionTypes'

export {
  emptyNodes,
  emptySlots,
  toReasoningInput,
  uniqueStrings,
  isoNow,
  newId,
} from './reflectionTypes'

export {
  CONSULTANT_REFLECTION_FEATURE_ID,
  isConsultantReflectionEnabled,
} from './reflectionFeature'

export {
  ConversationMemory,
  extractSlotDeltaFromText,
  appendUserTurn,
  combinedUserText,
} from './conversationMemory'

export {
  TravelerState,
  mergeSlots,
  derivePriorities,
  applyTurnToState,
  createInitialState,
  changedSlotKeys,
} from './travelerState'

export {
  NodeInvalidation,
  computeDirtyNodes,
  allReasoningNodes,
} from './nodeInvalidation'

export {
  ConfidenceTracker,
  snapshotConfidence,
  confidenceDelta,
  latestOverallConfidence,
} from './confidenceTracker'

export {
  ClarificationPriority,
  buildClarificationQueue,
} from './clarificationPriority'

export {
  AssumptionTracker,
  syncAssumptions,
  invalidateAssumptionsOnTurn,
  activeAssumptionTexts,
} from './assumptionTracker'

export {
  DecisionHistory,
  appendDecision,
  latestDecision,
} from './decisionHistory'

export {
  RecommendationRefiner,
  buildRecommendationRecord,
  refineReasonForChange,
} from './recommendationRefiner'

export {
  AlternativeExplorer,
  exploreAlternatives,
} from './alternativeExplorer'

export {
  ExplanationRevision,
  reviseExplanation,
} from './explanationRevision'

export {
  refreshDirtyNodes,
  nodesToBundle,
} from './nodeRefresh'

export {
  ReflectionPipeline,
  createReflectionSession,
  reflectTurn,
  tryReflectTurn,
} from './reflectionPipeline'
