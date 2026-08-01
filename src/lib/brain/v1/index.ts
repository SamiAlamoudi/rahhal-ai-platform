/**
 * Sprint 81/82 — Rahhal AI Brain Foundation + Reasoning Engine
 *
 * Additive architecture under `src/lib/brain/v1/`.
 * Feature flag `ai.brain.v1` defaults OFF.
 * Not wired into travelAgentService.planTurn / Voice / UI.
 */

export { BRAIN_V1_VERSION, emptyBrainV1Entities, emptyPlannerState } from './types'
export type {
  BrainV1Clarification,
  BrainV1ConversationMemory,
  BrainV1Entities,
  BrainV1Explanation,
  BrainV1Intent,
  BrainV1IntentResult,
  BrainV1LongTermMemory,
  BrainV1MissingField,
  BrainV1Offer,
  BrainV1PlannerState,
  BrainV1PlannerStep,
  BrainV1PlannerStepId,
  BrainV1PreferenceMemory,
  BrainV1ReasoningStep,
  BrainV1ScoreBreakdown,
  BrainV1SessionMemory,
  BrainV1ToolId,
  BrainV1TravelPreferences,
  BrainV1TurnInput,
  BrainV1TurnResult,
  BrainV1UserProfile,
} from './types'

export { BRAIN_V1_FEATURE_ID, isBrainV1Enabled } from './feature'

export { IntentDetector, createIntentDetector } from './IntentDetector'
export { EntityExtractor, createEntityExtractor } from './EntityExtractor'
export { SessionState, createSessionState } from './SessionState'
export { ConversationHistory, createConversationHistory } from './ConversationHistory'
export { ConversationContext, createConversationContext } from './ConversationContext'
export { MemoryManager, createMemoryManager } from './MemoryManager'
export { ClarificationPlanner, createClarificationPlanner } from './ClarificationPlanner'
export { ToolRegistry, createToolRegistry, type BrainV1ToolDefinition } from './ToolRegistry'
export { ToolDecisionEngine, createToolDecisionEngine } from './ToolDecisionEngine'
export { TravelReasoner, createTravelReasoner } from './TravelReasoner'
export {
  getDestinationInsight,
  buildDestinationReasoningLines,
  indicativeBudgetForSlots,
  inferTripStyle,
  resolveInsightKey,
  reasonFromDestinationKnowledge,
  type DestinationInsight,
  type TripStyleHint,
} from './destinationInsights'

export {
  ensureDestinationKnowledgeLoaded,
  registerDestinationKnowledge,
  getDestinationKnowledgeByKey,
  listDestinationKnowledge,
  resolveDestinationKnowledgeKey,
  buildExplainableRecommendation,
  type DestinationKnowledge,
  type DestinationReasoning,
  type CityKnowledge,
  type ExplainableRecommendation,
  type DestinationAlternative,
} from './destinationKnowledge'
export {
  RecommendationEngine,
  createRecommendationEngine,
  DEFAULT_RANKING_WEIGHTS,
  type RankingWeights,
} from './RecommendationEngine'
export { ExplainabilityEngine, createExplainabilityEngine } from './ExplainabilityEngine'
export {
  ConversationPlanner,
  createConversationPlanner,
  type BrainV1Plan,
} from './ConversationPlanner'
export { PromptBuilder, createPromptBuilder } from './PromptBuilder'
export { ResponseComposer, createResponseComposer } from './ResponseComposer'
export { SafetyLayer, createSafetyLayer } from './SafetyLayer'
export { runBrainV1Turn, type BrainV1PipelineDeps } from './pipeline'

export {
  BRAIN_AGENT_ORCHESTRATOR_VERSION,
  AgentRegistry,
  createAgentRegistry,
  AgentOrchestrator,
  createAgentOrchestrator,
  runBrainAgentOrchestrator,
  DependencyGraph,
  createDependencyGraph,
  DEFAULT_BRAIN_AGENTS,
  type BrainAgentId,
  type BrainAgentLifecycle,
  type BrainAgentDefinition,
  type BrainAgentOrchestratorResult,
  type BrainAgentSelection,
  type AgentOrchestratorDeps,
} from './agents'

export {
  TRAVEL_PLANNING_ENGINE_VERSION,
  emptyTravelPlanSlots,
  createTravelPlanningEngine,
  runTravelPlanningTurn,
  createSlotFillingEngine,
  createQuestionPlanner,
  createPlanValidator,
  createItinerarySkeletonBuilder,
  type TravelPlan,
  type TravelGoal,
  type TravelPlanningTurnResult,
  type PlanningConversationState,
  type ItinerarySkeleton,
} from './planning'

export {
  TOOL_EXECUTION_ENGINE_VERSION,
  createToolExecutionEngine,
  runToolExecution,
  buildDefaultTripDecisions,
  createToolExecutor,
  createExecutionSimulator,
  createDependencyResolver,
  createResultMerger,
  createCancellationToken,
  type ToolDecision,
  type ToolExecutionResponse,
  type ExecutableToolType,
  type UnifiedToolResult,
} from './execution'

export {
  CONVERSATION_MANAGER_VERSION,
  createConversationManager,
  runConversationManagerTurn,
  createQuestionGenerator,
  createResponseGenerator,
  createConfidenceEngine,
  createConversationSummaryBuilder,
  createInterruptHandler,
  createConversationExplainability,
  createAssumptionEngine,
  createValueFirstPlanner,
  createClarificationPolicy,
  normalizeToolMissingFields,
  pickSingleToolField,
  DEFAULT_MAX_QUESTIONS_PER_TURN,
  type ConversationManagerResult,
  type ConversationSession,
  type ConversationSummary,
  type ConversationQuestion,
  type ConversationAssumption,
  type ConversationValueItem,
  type ConversationDecisionModel,
  type ClarificationTier,
  type ConfidenceBand,
} from './conversation'

export {
  BRAIN_V1_PREVIEW_FEATURE_ID,
  BRAIN_V1_PREVIEW_VERSION,
  isBrainV1PreviewEnabled,
  isBrainPreviewDeployTargetAllowed,
  routeBrainPreviewTurn,
  tryBrainV1PreviewTurn,
  extractBrainPreviewSession,
  type BrainRouterDecision,
  type BrainRouterInput,
  type BrainRouterPath,
} from './preview'
