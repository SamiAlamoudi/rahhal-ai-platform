/**
 * Sprint 91 — Production Alpha Experience (core barrel).
 * Additive orchestration / presentation — reuses existing engines only.
 */

export {
  SPRINT91_ALPHA_EXPERIENCE_VERSION,
  type AlphaTimelineStageId,
  type AlphaTimelineStatus,
  type AlphaTimelineStage,
  type AlphaProgressTimeline,
  type AlphaScenarioKind,
  type AlphaConfidenceBreakdown,
  type AlphaExplanation,
  type AlphaTripSummary,
  type AlphaFlightPresentation,
  type AlphaHotelPresentation,
  type AlphaTransportPresentation,
  type AlphaActivityPresentation,
  type AlphaAlternativeScenario,
  type AlphaRecommendation,
  type AlphaExperienceEventName,
  type AlphaExperienceEvent,
  type AlphaOrchestrationRequirements,
  type AlphaOrchestrationInput,
  type AlphaOrchestrationResult,
} from './types'

export {
  createProgressTimeline,
  ProgressTimelineTracker,
} from './ProgressTimeline'

export {
  toTravelerRecoveryMessage,
  buildBudgetAdjustmentPrompt,
} from './ErrorExperience'

export { emitAlphaEvent, resetAlphaEventList } from './events'

export { aggregateConfidence } from './ConfidenceAggregator'

export { buildAlphaExplanation } from './ExplanationBuilder'

export { buildAlternativeScenarios } from './AlternativeScenarios'

export { presentRecommendation } from './RecommendationPresenter'

export {
  ConversationOrchestrator,
  createConversationOrchestrator,
  runAlphaExperience,
} from './ConversationOrchestrator'
