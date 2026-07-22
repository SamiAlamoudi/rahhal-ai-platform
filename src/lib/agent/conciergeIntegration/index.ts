/**
 * Sprint 97 — Concierge UI Integration (agent barrel).
 * Presentation adapters only — no engine redesign.
 */

export {
  SPRINT97_CONCIERGE_INTEGRATION_VERSION,
  emptyRecommendationResponseDto,
  type ConciergeTimelineStageDto,
  type ConciergeTimelineDto,
  type ConciergeConfidenceDto,
  type ConciergeSummaryDto,
  type ConciergeAlternativeDto,
  type ConciergeComparisonCardDto,
  type ConciergeSuggestionDto,
  type RecommendationResponseDto,
  type ConversationResponseDto,
  type TripResponseDto,
} from './types'

export {
  serializeTimeline,
  serializeConfidence,
  serializeSummary,
  serializeAlternatives,
  serializeComparisonCards,
  serializeSuggestions,
  toRecommendationResponseDto,
  toConversationResponseDto,
  toTripResponseDto,
} from './serializers'

export {
  tripFactsFromMemory,
  offersFromEngineSnapshots,
} from './adapters'

export {
  integrateConciergeIntoTurn,
  type ConciergeTurnIntegrationInput,
  type ConciergeTurnIntegrationResult,
} from './pipeline'
