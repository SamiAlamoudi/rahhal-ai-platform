/**
 * Phase 3 Stage 5 — Experience Intelligence Layer barrel.
 *
 * Isolated presentation package. Not wired into planTurn.
 */

export type {
  ExperienceLocale,
  ExperienceCardKind,
  ExperienceCard,
  ExperienceTimelineItem,
  ExperienceSection,
  ExperienceTripSummaryModel,
  ExperienceModel,
  ExperienceVoiceSession,
  ExperienceVoiceReply,
  ExperienceVoiceTranscript,
  ExperienceVoiceAction,
  ExperienceVoiceContext,
  ExperienceKnowledgeBook,
  ExperienceTravelGuide,
  ExperienceVisaGuide,
  ExperiencePdfLibraryItem,
  ExperienceSavedArticle,
  ExperienceFavorite,
  ExperienceKnowledgeSurface,
  ExperienceFutureModuleId,
  ExperienceFutureModulePlaceholder,
  ExperienceComposerInput,
  ExperienceComposerResult,
  ExperienceMetaSnapshot,
} from './types'

export { clamp01, isoNow, uniqueStrings } from './types'

export {
  EXPERIENCE_LAYER_FEATURE_ID,
  isExperienceLayerEnabled,
  EXPERIENCE_FUTURE_MODULES,
  ExperienceRegistry,
} from './experienceRegistry'

export {
  createExperienceCard,
  placeholderCard,
  ExperienceCards,
} from './experienceCards'

export {
  extractExperienceSourceFacts,
  buildExperienceTripSummary,
  buildExecutiveSummaryCard,
  TripSummary,
} from './tripSummary'
export type { ExperienceSourceFacts } from './tripSummary'

export { buildTripHighlights, TripHighlights } from './tripHighlights'

export {
  buildDestinationHighlights,
  DestinationHighlights,
} from './destinationHighlights'

export {
  buildExperienceTimeline,
  timelineLocaleLabel,
  TimelineBuilder,
} from './timelineBuilder'

export {
  buildRecommendedActionCards,
  buildImportantAlertCards,
  buildAlternativeCards,
  buildQuickFactCards,
  buildPlaceholderCards,
  RecommendationCards,
} from './recommendationCards'

export { buildExperienceSections, TripSections } from './tripSections'

export {
  composeExperience,
  tryComposeExperience,
  enrichTurnWithExperienceLayer,
  ExperienceComposer,
} from './experienceComposer'
export type {
  ExperienceTurnLike,
  ExperienceTurnOptions,
} from './experienceComposer'
