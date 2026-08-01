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
