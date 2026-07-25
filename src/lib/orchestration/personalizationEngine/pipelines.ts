/**
 * Personalization engine contracts — pure builders, no learning or scoring.
 */

import type {
  ActivityRecommendationContract,
  BehaviorLearningContract,
  BudgetAwarenessContract,
  CompanionAwarenessContract,
  ConversationTonePersonalizationContract,
  DestinationRecommendationContract,
  DynamicUserSegmentsContract,
  FavoriteActivityRankingContract,
  FavoriteAirlineRankingContract,
  FavoriteDestinationRankingContract,
  FavoriteHotelRankingContract,
  FavoriteRestaurantRankingContract,
  HotelRecommendationContract,
  IntentPredictionContract,
  InterestDetectionContract,
  LocationAwarenessContract,
  OfferPersonalizationContract,
  PersonalizationAuditTrailContract,
  PersonalizationContextContract,
  PersonalizationEngineContract,
  PersonalizationLocale,
  PersonalizationProfileContract,
  PersonalizationTimelineContract,
  PreferenceConfidenceContract,
  PreferenceLearningContract,
  PreferenceRankingContract,
  RecommendationContextContract,
  RecommendationFeedbackContract,
  RecommendationScoringContract,
  RestaurantRecommendationContract,
  SeasonalityModelContract,
  TransportationRecommendationContract,
  TravelHistoryAnalysisContract,
  TravelPatternAnalysisContract,
  TravelerPersonasContract,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildPersonalizationEngine(): PersonalizationEngineContract {
  return {
    kind: 'personalization_engine',
    version: '7.3.0-personalization-engine',
    execution: 'none',
  }
}

export function buildPersonalizationProfile(
  locale: PersonalizationLocale = 'ar',
): PersonalizationProfileContract {
  return {
    kind: 'personalization_profile',
    profileId: 'pp-architecture',
    locale,
    linkedTravelerProfileHint: true,
    linkedLoyaltyHint: true,
    execution: 'none',
  }
}

export function buildPreferenceLearning(): PreferenceLearningContract {
  return {
    kind: 'preference_learning',
    learningKeys: [],
    execution: 'none',
  }
}

export function buildBehaviorLearning(): BehaviorLearningContract {
  return {
    kind: 'behavior_learning',
    signalKeys: [],
    execution: 'none',
  }
}

export function buildTravelPatternAnalysis(): TravelPatternAnalysisContract {
  return {
    kind: 'travel_pattern_analysis',
    patternHints: [],
    execution: 'none',
  }
}

export function buildIntentPrediction(): IntentPredictionContract {
  return {
    kind: 'intent_prediction',
    intentHints: [],
    predicted: false,
    execution: 'none',
  }
}

export function buildRecommendationContext(): RecommendationContextContract {
  return {
    kind: 'recommendation_context',
    contextKeys: [
      'traveler_profile_hint',
      'loyalty_hint',
      'conversation_hint',
      'behavior_hint',
      'history_hint',
    ],
    execution: 'none',
  }
}

export function buildPersonalizationContext(
  sessionId: string,
): PersonalizationContextContract {
  return {
    kind: 'personalization_context',
    sessionId,
    sourceHints: [
      'profile',
      'loyalty',
      'conversations',
      'behavior',
      'history',
      'context',
    ],
    execution: 'none',
  }
}

export function buildDynamicUserSegments(): DynamicUserSegmentsContract {
  return {
    kind: 'dynamic_user_segments',
    segmentHints: [],
    execution: 'none',
  }
}

export function buildTravelerPersonas(): TravelerPersonasContract {
  return {
    kind: 'traveler_personas',
    personaHints: [],
    execution: 'none',
  }
}

export function buildPreferenceConfidence(): PreferenceConfidenceContract {
  return {
    kind: 'preference_confidence',
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildPreferenceRanking(): PreferenceRankingContract {
  return {
    kind: 'preference_ranking',
    rankedKeys: [],
    execution: 'none',
  }
}

export function buildInterestDetection(): InterestDetectionContract {
  return {
    kind: 'interest_detection',
    interestHints: [],
    execution: 'none',
  }
}

export function buildSeasonalityModel(): SeasonalityModelContract {
  return {
    kind: 'seasonality_model',
    seasonHints: [],
    execution: 'none',
  }
}

export function buildLocationAwareness(): LocationAwarenessContract {
  return {
    kind: 'location_awareness',
    locationKeys: [],
    execution: 'none',
  }
}

export function buildBudgetAwareness(): BudgetAwarenessContract {
  return {
    kind: 'budget_awareness',
    currencyHint: 'SAR',
    bandHint: 'unspecified',
    execution: 'none',
  }
}

export function buildCompanionAwareness(): CompanionAwarenessContract {
  return {
    kind: 'companion_awareness',
    companionHints: [],
    execution: 'none',
  }
}

export function buildTravelHistoryAnalysis(): TravelHistoryAnalysisContract {
  return {
    kind: 'travel_history_analysis',
    historyKeys: [],
    execution: 'none',
  }
}

export function buildFavoriteDestinationRanking(): FavoriteDestinationRankingContract {
  return {
    kind: 'favorite_destination_ranking',
    rankedHints: [],
    execution: 'none',
  }
}

export function buildFavoriteActivityRanking(): FavoriteActivityRankingContract {
  return {
    kind: 'favorite_activity_ranking',
    rankedHints: [],
    execution: 'none',
  }
}

export function buildFavoriteHotelRanking(): FavoriteHotelRankingContract {
  return {
    kind: 'favorite_hotel_ranking',
    rankedHints: [],
    execution: 'none',
  }
}

export function buildFavoriteAirlineRanking(): FavoriteAirlineRankingContract {
  return {
    kind: 'favorite_airline_ranking',
    rankedHints: [],
    execution: 'none',
  }
}

export function buildFavoriteRestaurantRanking(): FavoriteRestaurantRankingContract {
  return {
    kind: 'favorite_restaurant_ranking',
    rankedHints: [],
    execution: 'none',
  }
}

export function buildRecommendationScoring(): RecommendationScoringContract {
  return {
    kind: 'recommendation_scoring',
    scoreHints: [],
    executed: false,
    execution: 'none',
  }
}

export function buildRecommendationFeedback(): RecommendationFeedbackContract {
  return {
    kind: 'recommendation_feedback',
    feedbackHints: [],
    execution: 'none',
  }
}

export function buildPersonalizationTimeline(): PersonalizationTimelineContract {
  return {
    kind: 'personalization_timeline',
    events: [
      {
        eventId: 'ptl-opened',
        eventKind: 'engine_opened',
        atIso: ISO,
        summary: 'architecture blueprint',
      },
    ],
    execution: 'none',
  }
}

export function buildPersonalizationAuditTrail(): PersonalizationAuditTrailContract {
  return {
    kind: 'personalization_audit_trail',
    entries: [
      {
        id: 'paudit-open',
        atIso: ISO,
        action: 'engine_opened',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}

export function buildDestinationRecommendation(): DestinationRecommendationContract {
  return {
    kind: 'destination_recommendation_contract',
    recommendationKeys: [],
    execution: 'none',
  }
}

export function buildHotelRecommendation(): HotelRecommendationContract {
  return {
    kind: 'hotel_recommendation_contract',
    recommendationKeys: [],
    execution: 'none',
  }
}

export function buildActivityRecommendation(): ActivityRecommendationContract {
  return {
    kind: 'activity_recommendation_contract',
    recommendationKeys: [],
    execution: 'none',
  }
}

export function buildRestaurantRecommendation(): RestaurantRecommendationContract {
  return {
    kind: 'restaurant_recommendation_contract',
    recommendationKeys: [],
    execution: 'none',
  }
}

export function buildTransportationRecommendation(): TransportationRecommendationContract {
  return {
    kind: 'transportation_recommendation_contract',
    recommendationKeys: [],
    execution: 'none',
  }
}

export function buildConversationTonePersonalization(): ConversationTonePersonalizationContract {
  return {
    kind: 'conversation_tone_personalization_contract',
    toneHints: ['formal_hint', 'friendly_hint'],
    execution: 'none',
  }
}

export function buildOfferPersonalization(): OfferPersonalizationContract {
  return {
    kind: 'offer_personalization_contract',
    offerKeys: [],
    execution: 'none',
  }
}
