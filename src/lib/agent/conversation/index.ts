/**
 * Phase 3 Stage 1 — Conversation Orchestrator barrel.
 */

export type {
  ConversationLocale,
  ConversationIntent,
  ConversationReplyFormat,
  ConfidenceBand,
  ConversationKnownFacts,
  ConversationTurnRecord,
  ConversationState,
  ConversationOrchestratorInput,
  ConversationOrchestratorResult,
} from './types'

export {
  clamp01,
  uniqueStrings,
  isoNow,
  confidenceBand,
} from './types'

export {
  CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  isConversationOrchestratorEnabled,
  INTENT_STAGE_MAP,
  ConversationRegistry,
} from './conversationRegistry'

export {
  detectConversationIntent,
  ConversationIntentDetector,
} from './conversationIntent'

export {
  createEmptyConversationState,
  withIntentGoal,
  syncTripFromFacts,
  ConversationStateHelpers,
} from './conversationState'

export {
  loadConversationMemory,
  saveConversationMemory,
  resetConversationMemory,
  mergeKnownFacts,
  appendConversationTurn,
  markQuestionAnswered,
  setPendingClarification,
  setMissingInformation,
  wasQuestionAsked,
  normalizeQuestionKey,
  withLastIntent,
  ConversationMemory,
} from './conversationMemory'

export {
  buildConversationContext,
  extractKnownFactsFromText,
  computeMissingInformation,
  scoreConversationConfidence,
  ConversationContext,
} from './conversationContext'
export type { ConversationContextBag } from './conversationContext'

export {
  planConversationStages,
  ConversationPlanner,
} from './conversationPlanner'

export {
  buildConversationReply,
  ConversationReply,
} from './conversationReply'
export type {
  ConversationReplyBuildInput,
  ConversationReplyBuildResult,
} from './conversationReply'

export {
  runConversationOrchestrator,
  tryRunConversationOrchestrator,
  enrichTurnWithConversationOrchestrator,
  ConversationOrchestrator,
} from './conversationOrchestrator'
export type {
  ConversationOrchestratorTurnOptions,
  ConversationTurnLike,
} from './conversationOrchestrator'
