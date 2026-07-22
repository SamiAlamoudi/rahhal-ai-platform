/**
 * Sprint 111 — AI Concierge Experience (Decision Conversation Layer) barrel.
 */

export {
  SPRINT111_CONCIERGE_VERSION,
  type ConciergeTravelerPersona,
  type ConciergeTradeoffKind,
  type ConciergeScenarioKind,
  type ConciergeRecommendationOption,
  type ConciergeInput,
  type ConciergeExplanation,
  type ConciergeTradeoff,
  type ConciergeScenario,
  type ConciergeSavingsAnalysis,
  type ConciergeNarrative,
  type ConciergeConversationMetadata,
  type ConciergeResult,
  type ConciergeLogEntry,
  type ConciergeStructuredLogger,
  createSilentConciergeLogger,
} from './types'

export {
  CONCIERGE_FEATURE_ID,
  isConciergeEnabled,
} from './feature'

export {
  explainConversation,
  ConversationExplainer,
  createConversationExplainer,
} from './ConversationExplainer'

export {
  analyzeTradeoffs,
  TradeoffAnalyzer,
  createTradeoffAnalyzer,
} from './TradeoffAnalyzer'

export {
  simulateScenarios,
  ScenarioSimulator,
  createScenarioSimulator,
} from './ScenarioSimulator'

export {
  analyzeSavings,
  SavingsAnalyzer,
  createSavingsAnalyzer,
} from './SavingsAnalyzer'

export {
  narrateRecommendation,
  RecommendationNarrator,
  createRecommendationNarrator,
} from './RecommendationNarrator'

export {
  buildConversationMetadata,
  optionsFromResponseComposer,
  ConversationMetadata,
  createConversationMetadata,
} from './ConversationMetadata'

export {
  ConciergeRunner,
  createConciergeRunner,
  runConcierge,
  type ConciergeRunnerOptions,
} from './ConciergeRunner'
