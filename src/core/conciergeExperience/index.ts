/**
 * Sprint 96 — AI Concierge Experience (core barrel).
 * Additive presentation / explanation layer — does not redesign engines.
 */

export {
  SPRINT96_AI_CONCIERGE_VERSION,
  type ConciergeTimelineStageId,
  type ConciergeTimelineStatus,
  type ConciergeTimelineStage,
  type ConciergeRecommendationTimeline,
  type ConciergeConfidenceLevel,
  type ConciergeConfidenceIndicator,
  type ConciergeExplanation,
  type ConciergeScenarioKind,
  type ConciergeAlternativeScenario,
  type ConciergeComparisonCard,
  type ConciergeSuggestionKind,
  type ConciergeSuggestion,
  type ConciergeConversationSummary,
  type ConciergeTripFacts,
  type ConciergeOfferFacts,
  type ConciergeComposeRequest,
  type ConciergeExperienceResult,
} from './types'

export {
  RecommendationTimelineTracker,
  createRecommendationTimeline,
  runRecommendationTimeline,
} from './RecommendationTimeline'

export { buildConciergeExplanation } from './ExplanationEngine'
export { buildConciergeAlternatives } from './AlternativeScenarios'
export { buildConfidenceIndicator } from './ConfidenceIndicator'
export { buildConversationSummary } from './ConversationSummary'
export { buildComparisonCards } from './ComparisonCards'
export { buildConciergeSuggestions } from './ConciergeSuggestions'

export {
  ConciergeComposer,
  createConciergeComposer,
  composeConciergeExperience,
} from './ConciergeComposer'
