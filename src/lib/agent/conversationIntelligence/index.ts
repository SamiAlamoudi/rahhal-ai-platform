/**
 * Phase 4 — Conversation Intelligence (modular, reusable, flag-gated).
 *
 * Modules: ConversationMemory · EntityExtractor · IntentDetector ·
 * ReferenceResolver · ConversationSummarizer · QuestionPlanner · TravelConsultant
 */

export type {
  ConsultantLocale,
  ConversationIntelligenceAnalyzeInput,
  ConversationIntelligenceResult,
  ConversationIntentKind,
  ConversationSummary,
  ExtractedEntities,
  IntelligentQuestion,
  LiveTravelMemory,
  ProactiveInsight,
  ResolvedReference,
  TravelerBreakdown,
  TripPurposeKind,
} from './types'

export {
  ConversationMemory,
  createEmptyLiveTravelMemory,
  emptyTravelerBreakdown,
  updateLiveTravelMemory,
} from './conversationMemory'

export { extractEntities, EntityExtractor } from './entityExtractor'
export {
  detectConversationIntent,
  IntentDetector,
  type IntentDetectionResult,
} from './intentDetector'
export { resolveReferences, ReferenceResolver } from './referenceResolver'
export {
  summarizeConversation,
  formatSummaryForConsultant,
  ConversationSummarizer,
} from './conversationSummarizer'
export {
  planIntelligentQuestions,
  filterInterviewMissingFields,
  QuestionPlanner,
} from './questionPlanner'
export {
  buildProactiveInsights,
  buildConsultantNotes,
  TravelConsultant,
} from './travelConsultant'
export {
  analyzeConversation,
  analyzeWithMemoryStore,
  applyReferencesToEntities,
  PHASE4_CONVERSATION_INTELLIGENCE_VERSION,
} from './analyze'
export {
  CONVERSATION_INTELLIGENCE_FEATURE_ID,
  isConversationIntelligenceEnabled,
} from './feature'
export { enrichWithConversationIntelligence } from './enrich'
