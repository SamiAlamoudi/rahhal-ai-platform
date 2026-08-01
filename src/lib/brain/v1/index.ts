/**
 * Sprint 81 — Rahhal AI Brain Foundation (Phase 1)
 *
 * Additive architecture under `src/lib/brain/v1/`.
 * Feature flag `ai.brain.v1` defaults OFF.
 * Not wired into travelAgentService.planTurn.
 */

export { BRAIN_V1_VERSION } from './types'
export type {
  BrainV1Clarification,
  BrainV1ConversationMemory,
  BrainV1Entities,
  BrainV1Intent,
  BrainV1IntentResult,
  BrainV1LongTermMemory,
  BrainV1MissingField,
  BrainV1Offer,
  BrainV1ReasoningStep,
  BrainV1SessionMemory,
  BrainV1ToolId,
  BrainV1TravelPreferences,
  BrainV1TurnInput,
  BrainV1TurnResult,
  BrainV1UserProfile,
} from './types'
export { emptyBrainV1Entities } from './types'

export { BRAIN_V1_FEATURE_ID, isBrainV1Enabled } from './feature'

export { IntentDetector, createIntentDetector } from './IntentDetector'
export { EntityExtractor, createEntityExtractor } from './EntityExtractor'
export { SessionState, createSessionState } from './SessionState'
export { ConversationHistory, createConversationHistory } from './ConversationHistory'
export { ConversationContext, createConversationContext } from './ConversationContext'
export { MemoryManager, createMemoryManager } from './MemoryManager'
export { ClarificationPlanner, createClarificationPlanner } from './ClarificationPlanner'
export { ToolDecisionEngine, createToolDecisionEngine } from './ToolDecisionEngine'
export { TravelReasoner, createTravelReasoner } from './TravelReasoner'
export { RecommendationEngine, createRecommendationEngine } from './RecommendationEngine'
export {
  ConversationPlanner,
  createConversationPlanner,
  type BrainV1Plan,
} from './ConversationPlanner'
export { PromptBuilder, createPromptBuilder } from './PromptBuilder'
export { ResponseComposer, createResponseComposer } from './ResponseComposer'
export { SafetyLayer, createSafetyLayer } from './SafetyLayer'
export { runBrainV1Turn, type BrainV1PipelineDeps } from './pipeline'
