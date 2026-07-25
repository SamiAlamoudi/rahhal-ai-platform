/**
 * Phase 7 Stage 3 — AI Personalization Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.personalization_engine` (default OFF).
 * Distinct from `ai.personalization` / `ai.recommendation_engine`.
 * No LLM, recommendation execution, DB, Runtime, HTTP, or APIs.
 */

import { PERSONALIZATION_ENGINE_ISOLATION as PE_ISOLATION } from './types'
import { PERSONALIZATION_SECTION_IDS } from './types'

export {
  BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID,
  isBrainPersonalizationEngineEnabled,
  listPersonalizationRegistry,
  listPersonalizationSectionIds,
  PersonalizationRegistry,
  PERSONALIZATION_REGISTRY,
} from './registry'

export type {
  PersonalizationLocale,
  PersonalizationTimelineEventKind,
  PersonalizationSectionId,
  PersonalizationEngineContract,
  PersonalizationProfileContract,
  PreferenceLearningContract,
  BehaviorLearningContract,
  TravelPatternAnalysisContract,
  IntentPredictionContract,
  RecommendationContextContract,
  PersonalizationContextContract,
  DynamicUserSegmentsContract,
  TravelerPersonasContract,
  PreferenceConfidenceContract,
  PreferenceRankingContract,
  InterestDetectionContract,
  SeasonalityModelContract,
  LocationAwarenessContract,
  BudgetAwarenessContract,
  CompanionAwarenessContract,
  TravelHistoryAnalysisContract,
  FavoriteDestinationRankingContract,
  FavoriteActivityRankingContract,
  FavoriteHotelRankingContract,
  FavoriteAirlineRankingContract,
  FavoriteRestaurantRankingContract,
  RecommendationScoringContract,
  RecommendationFeedbackContract,
  PersonalizationTimelineEvent,
  PersonalizationTimelineContract,
  PersonalizationAuditEntry,
  PersonalizationAuditTrailContract,
  DestinationRecommendationContract,
  HotelRecommendationContract,
  ActivityRecommendationContract,
  RestaurantRecommendationContract,
  TransportationRecommendationContract,
  ConversationTonePersonalizationContract,
  OfferPersonalizationContract,
  PersonalizationRegistryEntry,
  PersonalizationEngineBlueprint,
} from './types'

export {
  PERSONALIZATION_ENGINE_ISOLATION,
  PERSONALIZATION_SECTION_IDS,
} from './types'

export {
  buildPersonalizationEngine,
  buildPersonalizationProfile,
  buildPreferenceLearning,
  buildBehaviorLearning,
  buildTravelPatternAnalysis,
  buildIntentPrediction,
  buildRecommendationContext,
  buildPersonalizationContext,
  buildDynamicUserSegments,
  buildTravelerPersonas,
  buildPreferenceConfidence,
  buildPreferenceRanking,
  buildInterestDetection,
  buildSeasonalityModel,
  buildLocationAwareness,
  buildBudgetAwareness,
  buildCompanionAwareness,
  buildTravelHistoryAnalysis,
  buildFavoriteDestinationRanking,
  buildFavoriteActivityRanking,
  buildFavoriteHotelRanking,
  buildFavoriteAirlineRanking,
  buildFavoriteRestaurantRanking,
  buildRecommendationScoring,
  buildRecommendationFeedback,
  buildPersonalizationTimeline,
  buildPersonalizationAuditTrail,
  buildDestinationRecommendation,
  buildHotelRecommendation,
  buildActivityRecommendation,
  buildRestaurantRecommendation,
  buildTransportationRecommendation,
  buildConversationTonePersonalization,
  buildOfferPersonalization,
} from './pipelines'

export {
  PersonalizationEngine,
  buildPersonalizationEngineBlueprint,
  tryBuildPersonalizationEngineBlueprint,
  assertPersonalizationEngineIsolation,
} from './engine'
export type { BuildPersonalizationBlueprintOptions } from './engine'

export const PERSONALIZATION_ENGINE_ARCHITECTURE = {
  version: '7.3.0-personalization-engine',
  featureId: 'brain.personalization_engine' as const,
  architectureOnly: true,
  components: [
    'personalization_engine',
    'personalization_profile',
    'preference_learning',
    'behavior_learning',
    'travel_pattern_analysis',
    'intent_prediction',
    'recommendation_context',
    'personalization_context',
    'dynamic_user_segments',
    'traveler_personas',
    'preference_confidence',
    'preference_ranking',
    'interest_detection',
    'seasonality_model',
    'location_awareness',
    'budget_awareness',
    'companion_awareness',
    'travel_history_analysis',
    'favorite_destination_ranking',
    'favorite_activity_ranking',
    'favorite_hotel_ranking',
    'favorite_airline_ranking',
    'favorite_restaurant_ranking',
    'recommendation_scoring',
    'recommendation_feedback',
    'personalization_timeline',
    'personalization_audit_trail',
    'destination_recommendation_contract',
    'hotel_recommendation_contract',
    'activity_recommendation_contract',
    'restaurant_recommendation_contract',
    'transportation_recommendation_contract',
    'conversation_tone_personalization_contract',
    'offer_personalization_contract',
  ] as const,
  sectionIds: PERSONALIZATION_SECTION_IDS,
  ...PE_ISOLATION,
} as const
