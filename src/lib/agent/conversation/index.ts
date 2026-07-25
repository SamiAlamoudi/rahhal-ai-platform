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

/** Phase 3 Stage 2 — Multi-Turn Conversation Manager */
export type {
  ConversationTopic,
  ConversationTurnEvent,
  TravelerFacts,
  DestinationFacts,
  StrategyFacts,
  UserCorrectionRecord,
  MultiTurnHistoryEntry,
  ShortTermMemory,
  WorkingMemory,
  LongTermMemory,
  MultiTurnConversationSession,
  MultiTurnManagerInput,
  MultiTurnManagerResult,
} from './memoryTypes'

export {
  createEmptyMultiTurnSession,
  cloneMultiTurnSession,
  syncWorkingFromSession,
} from './memoryTypes'

export {
  loadMultiTurnSession,
  saveMultiTurnSession,
  resetMultiTurnSessions,
  ConversationMemoryStore,
} from './conversationMemoryStore'

export {
  getOrCreateConversationSession,
  appendSessionTurn,
  setSessionTopicGoal,
  ConversationSession,
} from './conversationSession'

export {
  detectConversationTopic,
  TopicDetector,
} from './topicDetector'

export {
  trackConversationTurn,
  ConversationTracker,
} from './conversationTracker'
export type { TrackedTurn } from './conversationTracker'

export {
  decideClarification,
  computeSessionMissing,
  scoreMultiTurnConfidence,
  applyClarificationToSession,
  resolvePendingClarification,
  ClarificationManager,
} from './clarificationManager'
export type { ClarificationDecision } from './clarificationManager'

export {
  shouldSummarizeConversation,
  summarizeConversation,
  ConversationSummarizer,
  SUMMARY_TURN_THRESHOLD,
  SHORT_TERM_KEEP,
} from './conversationSummarizer'

export {
  planConversationRecovery,
  applyRecoveryToSession,
  withRecoveryPreamble,
  ConversationRecovery,
} from './conversationRecovery'
export type { RecoveryPlan } from './conversationRecovery'

export {
  MULTI_TURN_CONVERSATION_FEATURE_ID,
  isMultiTurnConversationEnabled,
  runMultiTurnManager,
  tryRunMultiTurnManager,
  enrichTurnWithMultiTurnManager,
  MultiTurnManager,
} from './multiTurnManager'
export type {
  MultiTurnTurnOptions,
  MultiTurnTurnLike,
} from './multiTurnManager'
