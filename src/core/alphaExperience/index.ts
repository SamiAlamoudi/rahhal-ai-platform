/**
 * Sprint 91 — Production Alpha Experience (core barrel).
 * Sprint 99 — Alpha Experience Assembly (unified traveler DTO) — additive.
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

/* ── Sprint 99 — Alpha Experience Assembly ─────────────────────────── */

export {
  SPRINT99_ALPHA_ASSEMBLY_VERSION,
  type ExperienceSectionId,
  type ExperiencePriorityLevel,
  type TravelerTimelineStage,
  type TravelerTimelineSection,
  type TravelerConciergeSection,
  type TravelerPackageSection,
  type TravelerFlightSection,
  type TravelerHotelSection,
  type TravelerPriceSection,
  type TravelerConfidenceSection,
  type TravelerAlternativeItem,
  type TravelerAlternativesSection,
  type TravelerExplanationSection,
  type TravelerSummarySection,
  type TravelerNextActionSection,
  type TravelerExperienceSection,
  type AlphaExperienceDTO,
  type AlphaExperienceComposeInput,
} from './AlphaExperienceDTO'

export {
  EXPERIENCE_SECTION_PRIORITY,
  priorityForSection,
  compareSectionIds,
} from './ExperiencePriority'

export {
  buildExperienceSections,
  dedupeStrings,
} from './ExperienceSections'

export { buildTravelerJourneyTimeline } from './TravelerJourney'

export {
  buildFinalRecommendationText,
  buildTravelerRecommendationHeadline,
} from './TravelerRecommendation'

export {
  buildTravelerSummaryText,
  buildTravelerKeyReasons,
} from './TravelerSummary'

export {
  buildAlphaExperienceDTO,
  dedupeExperienceSections,
} from './TravelerResponseBuilder'

export {
  AlphaExperienceComposer,
  createAlphaExperienceComposer,
  composeAlphaTravelerExperience,
} from './AlphaExperienceComposer'
