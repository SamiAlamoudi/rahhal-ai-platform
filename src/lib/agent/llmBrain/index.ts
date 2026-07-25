/**
 * Phase 5 — LLM Conversation Brain (modular, flag-gated, APIs disabled by default).
 *
 * LLM-first mock reasoner · Phase 4 rules as fallback.
 */

export type {
  ArabicDialect,
  ConfidenceLevel,
  ConversationStateSnapshot,
  ComposedResponse,
  FactCertainty,
  LlmBrainDebugTrace,
  LlmBrainLocale,
  LlmBrainMetaSnapshot,
  LlmBrainResult,
  LlmBrainRunInput,
  ReasoningStageId,
  ReasoningStageTrace,
  ToolDecision,
  ToolDecisionKind,
  TravelReasoningAspect,
  TravelReasoningResult,
} from './types'

export {
  LLM_CONVERSATION_BRAIN_FEATURE_ID,
  isLlmConversationBrainEnabled,
} from './feature'

export {
  ConversationState,
  createConversationState,
  detectArabicDialect,
  detectLocale,
  extractCorrections,
} from './conversationState'

export { ContextOptimizer, compressTravelFacts, optimizeContext } from './contextOptimizer'
export { PromptBuilder, buildLlmBrainPrompt, RAHHAL_LLM_BRAIN_SYSTEM_PROMPT } from './promptBuilder'
export { TravelReasoner, reasonAboutTravel } from './travelReasoner'
export { ToolDecisionEngine, decideTools } from './toolDecisionEngine'
export { ConfidenceEvaluator, evaluateConfidence, scoreToLevel } from './confidenceEvaluator'
export { ResponseComposer, composeConsultantResponse } from './responseComposer'
export { ConversationPlanner, planConversationStages, updateStage } from './conversationPlanner'
export { MockLlmReasoner, mockLlmUnderstand, mockLlmExtractEntities, mockLlmDetectIntent } from './mockLlmReasoner'
export {
  LLMConversationBrain,
  runLlmConversationBrain,
  PHASE5_LLM_CONVERSATION_BRAIN_VERSION,
} from './llmConversationBrain'
export { enrichWithLlmConversationBrain } from './enrich'
