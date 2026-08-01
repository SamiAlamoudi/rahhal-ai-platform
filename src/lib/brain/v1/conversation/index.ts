/**
 * Sprint 85 — Conversation Manager & Response Generator public API.
 * Feature flag: `ai.brain.v1` (OFF by default).
 */

export {
  CONVERSATION_MANAGER_VERSION,
  type ConversationLifecycleState,
  type ConversationQuestion,
  type ConversationResponse,
  type ConversationSummary,
  type ConversationConfidence,
  type ConversationExplanation,
  type ConversationSession,
  type ConversationManagerInput,
  type ConversationManagerResult,
  type ConversationTurnRecord,
} from './types'

export { ClarificationPolicy, createClarificationPolicy } from './ClarificationPolicy'
export { QuestionGenerator, createQuestionGenerator } from './QuestionGenerator'
export { ResponseGenerator, createResponseGenerator } from './ResponseGenerator'
export { ConfidenceEngine, createConfidenceEngine } from './ConfidenceEngine'
export {
  ConversationSummaryBuilder,
  createConversationSummaryBuilder,
} from './ConversationSummaryBuilder'
export { InterruptHandler, createInterruptHandler } from './InterruptHandler'
export {
  ConversationMemoryAdapter,
  createConversationMemoryAdapter,
} from './ConversationMemoryAdapter'
export {
  ConversationExplainability,
  createConversationExplainability,
} from './ConversationExplainability'
export {
  ConversationManager,
  createConversationManager,
  runConversationManagerTurn,
  type ConversationManagerDeps,
} from './ConversationManager'
