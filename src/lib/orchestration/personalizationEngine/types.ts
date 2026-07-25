/**
 * Phase 7 Stage 3 — AI Personalization Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * No LLM, recommendation execution, DB, Runtime, HTTP, or APIs.
 */

export type PersonalizationLocale = 'ar' | 'en'

export type PersonalizationTimelineEventKind =
  | 'engine_opened'
  | 'profile_attached'
  | 'preference_learned_hint'
  | 'behavior_learned_hint'
  | 'segment_hinted'
  | 'recommendation_scored_hint'
  | 'feedback_recorded_hint'
  | 'audit_appended'

export type PersonalizationSectionId =
  | 'personalization_engine'
  | 'personalization_profile'
  | 'preference_learning'
  | 'behavior_learning'
  | 'travel_pattern_analysis'
  | 'intent_prediction'
  | 'recommendation_context'
  | 'personalization_context'
  | 'dynamic_user_segments'
  | 'traveler_personas'
  | 'preference_confidence'
  | 'preference_ranking'
  | 'interest_detection'
  | 'seasonality_model'
  | 'location_awareness'
  | 'budget_awareness'
  | 'companion_awareness'
  | 'travel_history_analysis'
  | 'favorite_destination_ranking'
  | 'favorite_activity_ranking'
  | 'favorite_hotel_ranking'
  | 'favorite_airline_ranking'
  | 'favorite_restaurant_ranking'
  | 'recommendation_scoring'
  | 'recommendation_feedback'
  | 'personalization_timeline'
  | 'personalization_audit'
  | 'ai_destination_recommendation'
  | 'ai_hotel_recommendation'
  | 'ai_activity_recommendation'
  | 'ai_restaurant_recommendation'
  | 'ai_transportation_recommendation'
  | 'ai_conversation_tone'
  | 'ai_offer_personalization'

export interface PersonalizationEngineContract {
  kind: 'personalization_engine'
  version: '7.3.0-personalization-engine'
  execution: 'none'
}

export interface PersonalizationProfileContract {
  kind: 'personalization_profile'
  profileId: string
  locale: PersonalizationLocale
  linkedTravelerProfileHint: true
  linkedLoyaltyHint: true
  execution: 'none'
}

export interface PreferenceLearningContract {
  kind: 'preference_learning'
  learningKeys: readonly string[]
  execution: 'none'
}

export interface BehaviorLearningContract {
  kind: 'behavior_learning'
  signalKeys: readonly string[]
  execution: 'none'
}

export interface TravelPatternAnalysisContract {
  kind: 'travel_pattern_analysis'
  patternHints: readonly string[]
  execution: 'none'
}

export interface IntentPredictionContract {
  kind: 'intent_prediction'
  intentHints: readonly string[]
  predicted: false
  execution: 'none'
}

export interface RecommendationContextContract {
  kind: 'recommendation_context'
  contextKeys: readonly string[]
  execution: 'none'
}

export interface PersonalizationContextContract {
  kind: 'personalization_context'
  sessionId: string
  sourceHints: readonly string[]
  execution: 'none'
}

export interface DynamicUserSegmentsContract {
  kind: 'dynamic_user_segments'
  segmentHints: readonly string[]
  execution: 'none'
}

export interface TravelerPersonasContract {
  kind: 'traveler_personas'
  personaHints: readonly string[]
  execution: 'none'
}

export interface PreferenceConfidenceContract {
  kind: 'preference_confidence'
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface PreferenceRankingContract {
  kind: 'preference_ranking'
  rankedKeys: readonly string[]
  execution: 'none'
}

export interface InterestDetectionContract {
  kind: 'interest_detection'
  interestHints: readonly string[]
  execution: 'none'
}

export interface SeasonalityModelContract {
  kind: 'seasonality_model'
  seasonHints: readonly string[]
  execution: 'none'
}

export interface LocationAwarenessContract {
  kind: 'location_awareness'
  locationKeys: readonly string[]
  execution: 'none'
}

export interface BudgetAwarenessContract {
  kind: 'budget_awareness'
  currencyHint: string
  bandHint: string
  execution: 'none'
}

export interface CompanionAwarenessContract {
  kind: 'companion_awareness'
  companionHints: readonly string[]
  execution: 'none'
}

export interface TravelHistoryAnalysisContract {
  kind: 'travel_history_analysis'
  historyKeys: readonly string[]
  execution: 'none'
}

export interface FavoriteDestinationRankingContract {
  kind: 'favorite_destination_ranking'
  rankedHints: readonly string[]
  execution: 'none'
}

export interface FavoriteActivityRankingContract {
  kind: 'favorite_activity_ranking'
  rankedHints: readonly string[]
  execution: 'none'
}

export interface FavoriteHotelRankingContract {
  kind: 'favorite_hotel_ranking'
  rankedHints: readonly string[]
  execution: 'none'
}

export interface FavoriteAirlineRankingContract {
  kind: 'favorite_airline_ranking'
  rankedHints: readonly string[]
  execution: 'none'
}

export interface FavoriteRestaurantRankingContract {
  kind: 'favorite_restaurant_ranking'
  rankedHints: readonly string[]
  execution: 'none'
}

export interface RecommendationScoringContract {
  kind: 'recommendation_scoring'
  scoreHints: readonly string[]
  executed: false
  execution: 'none'
}

export interface RecommendationFeedbackContract {
  kind: 'recommendation_feedback'
  feedbackHints: readonly string[]
  execution: 'none'
}

export interface PersonalizationTimelineEvent {
  eventId: string
  eventKind: PersonalizationTimelineEventKind
  atIso: string
  summary: string
}

export interface PersonalizationTimelineContract {
  kind: 'personalization_timeline'
  events: readonly PersonalizationTimelineEvent[]
  execution: 'none'
}

export interface PersonalizationAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface PersonalizationAuditTrailContract {
  kind: 'personalization_audit_trail'
  entries: readonly PersonalizationAuditEntry[]
  persisted: false
}

/** AI personalization capability contracts — blueprints only. */
export interface DestinationRecommendationContract {
  kind: 'destination_recommendation_contract'
  recommendationKeys: readonly string[]
  execution: 'none'
}

export interface HotelRecommendationContract {
  kind: 'hotel_recommendation_contract'
  recommendationKeys: readonly string[]
  execution: 'none'
}

export interface ActivityRecommendationContract {
  kind: 'activity_recommendation_contract'
  recommendationKeys: readonly string[]
  execution: 'none'
}

export interface RestaurantRecommendationContract {
  kind: 'restaurant_recommendation_contract'
  recommendationKeys: readonly string[]
  execution: 'none'
}

export interface TransportationRecommendationContract {
  kind: 'transportation_recommendation_contract'
  recommendationKeys: readonly string[]
  execution: 'none'
}

export interface ConversationTonePersonalizationContract {
  kind: 'conversation_tone_personalization_contract'
  toneHints: readonly string[]
  execution: 'none'
}

export interface OfferPersonalizationContract {
  kind: 'offer_personalization_contract'
  offerKeys: readonly string[]
  execution: 'none'
}

export interface PersonalizationRegistryEntry {
  id: string
  sectionId: PersonalizationSectionId
  label: string
  enabledHint: false
}

export interface PersonalizationEngineBlueprint {
  version: '7.3.0-personalization-engine'
  featureId: 'brain.personalization_engine'
  architectureOnly: true
  engine: PersonalizationEngineContract
  profile: PersonalizationProfileContract
  preferenceLearning: PreferenceLearningContract
  behaviorLearning: BehaviorLearningContract
  travelPatternAnalysis: TravelPatternAnalysisContract
  intentPrediction: IntentPredictionContract
  recommendationContext: RecommendationContextContract
  personalizationContext: PersonalizationContextContract
  dynamicUserSegments: DynamicUserSegmentsContract
  travelerPersonas: TravelerPersonasContract
  preferenceConfidence: PreferenceConfidenceContract
  preferenceRanking: PreferenceRankingContract
  interestDetection: InterestDetectionContract
  seasonalityModel: SeasonalityModelContract
  locationAwareness: LocationAwarenessContract
  budgetAwareness: BudgetAwarenessContract
  companionAwareness: CompanionAwarenessContract
  travelHistoryAnalysis: TravelHistoryAnalysisContract
  favoriteDestinationRanking: FavoriteDestinationRankingContract
  favoriteActivityRanking: FavoriteActivityRankingContract
  favoriteHotelRanking: FavoriteHotelRankingContract
  favoriteAirlineRanking: FavoriteAirlineRankingContract
  favoriteRestaurantRanking: FavoriteRestaurantRankingContract
  recommendationScoring: RecommendationScoringContract
  recommendationFeedback: RecommendationFeedbackContract
  timeline: PersonalizationTimelineContract
  auditTrail: PersonalizationAuditTrailContract
  destinationRecommendation: DestinationRecommendationContract
  hotelRecommendation: HotelRecommendationContract
  activityRecommendation: ActivityRecommendationContract
  restaurantRecommendation: RestaurantRecommendationContract
  transportationRecommendation: TransportationRecommendationContract
  conversationTone: ConversationTonePersonalizationContract
  offerPersonalization: OfferPersonalizationContract
  registry: readonly PersonalizationRegistryEntry[]
}

export const PERSONALIZATION_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoLlms: false,
  recommendationExecution: false,
  wiredIntoDatabase: false,
  wiredIntoRuntime: false,
  streamingImplemented: false,
  httpRequests: false,
  wiredIntoAuthentication: false,
  wiredIntoApis: false,
  businessLogic: false,
  distinctFromAiPersonalization: true,
  distinctFromAiRecommendationEngine: true,
} as const

export const PERSONALIZATION_SECTION_IDS: readonly PersonalizationSectionId[] =
  [
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
    'personalization_audit',
    'ai_destination_recommendation',
    'ai_hotel_recommendation',
    'ai_activity_recommendation',
    'ai_restaurant_recommendation',
    'ai_transportation_recommendation',
    'ai_conversation_tone',
    'ai_offer_personalization',
  ] as const
