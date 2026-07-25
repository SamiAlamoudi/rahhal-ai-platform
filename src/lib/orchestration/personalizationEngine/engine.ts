/**
 * Personalization Engine facade — builds architecture blueprints only.
 * Never learns, scores, recommends, or calls LLMs.
 */

import { listPersonalizationRegistry } from './registry'
import { isBrainPersonalizationEngineEnabled } from './registry'
import {
  buildActivityRecommendation,
  buildBehaviorLearning,
  buildBudgetAwareness,
  buildCompanionAwareness,
  buildConversationTonePersonalization,
  buildDestinationRecommendation,
  buildDynamicUserSegments,
  buildFavoriteActivityRanking,
  buildFavoriteAirlineRanking,
  buildFavoriteDestinationRanking,
  buildFavoriteHotelRanking,
  buildFavoriteRestaurantRanking,
  buildHotelRecommendation,
  buildIntentPrediction,
  buildInterestDetection,
  buildLocationAwareness,
  buildOfferPersonalization,
  buildPersonalizationAuditTrail,
  buildPersonalizationContext,
  buildPersonalizationEngine,
  buildPersonalizationProfile,
  buildPersonalizationTimeline,
  buildPreferenceConfidence,
  buildPreferenceLearning,
  buildPreferenceRanking,
  buildRecommendationContext,
  buildRecommendationFeedback,
  buildRecommendationScoring,
  buildRestaurantRecommendation,
  buildSeasonalityModel,
  buildTransportationRecommendation,
  buildTravelHistoryAnalysis,
  buildTravelPatternAnalysis,
  buildTravelerPersonas,
} from './pipelines'
import type {
  PersonalizationEngineBlueprint,
  PersonalizationLocale,
} from './types'
import { PERSONALIZATION_ENGINE_ISOLATION } from './types'

export interface BuildPersonalizationBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: PersonalizationLocale
}

export function buildPersonalizationEngineBlueprint(
  options: BuildPersonalizationBlueprintOptions = {},
): PersonalizationEngineBlueprint {
  const sessionId = options.sessionId ?? 'personalization-session-architecture'
  const locale = options.locale ?? 'ar'

  return {
    version: '7.3.0-personalization-engine',
    featureId: 'brain.personalization_engine',
    architectureOnly: true,
    engine: buildPersonalizationEngine(),
    profile: buildPersonalizationProfile(locale),
    preferenceLearning: buildPreferenceLearning(),
    behaviorLearning: buildBehaviorLearning(),
    travelPatternAnalysis: buildTravelPatternAnalysis(),
    intentPrediction: buildIntentPrediction(),
    recommendationContext: buildRecommendationContext(),
    personalizationContext: buildPersonalizationContext(sessionId),
    dynamicUserSegments: buildDynamicUserSegments(),
    travelerPersonas: buildTravelerPersonas(),
    preferenceConfidence: buildPreferenceConfidence(),
    preferenceRanking: buildPreferenceRanking(),
    interestDetection: buildInterestDetection(),
    seasonalityModel: buildSeasonalityModel(),
    locationAwareness: buildLocationAwareness(),
    budgetAwareness: buildBudgetAwareness(),
    companionAwareness: buildCompanionAwareness(),
    travelHistoryAnalysis: buildTravelHistoryAnalysis(),
    favoriteDestinationRanking: buildFavoriteDestinationRanking(),
    favoriteActivityRanking: buildFavoriteActivityRanking(),
    favoriteHotelRanking: buildFavoriteHotelRanking(),
    favoriteAirlineRanking: buildFavoriteAirlineRanking(),
    favoriteRestaurantRanking: buildFavoriteRestaurantRanking(),
    recommendationScoring: buildRecommendationScoring(),
    recommendationFeedback: buildRecommendationFeedback(),
    timeline: buildPersonalizationTimeline(),
    auditTrail: buildPersonalizationAuditTrail(),
    destinationRecommendation: buildDestinationRecommendation(),
    hotelRecommendation: buildHotelRecommendation(),
    activityRecommendation: buildActivityRecommendation(),
    restaurantRecommendation: buildRestaurantRecommendation(),
    transportationRecommendation: buildTransportationRecommendation(),
    conversationTone: buildConversationTonePersonalization(),
    offerPersonalization: buildOfferPersonalization(),
    registry: listPersonalizationRegistry(),
  }
}

export function tryBuildPersonalizationEngineBlueprint(
  options: BuildPersonalizationBlueprintOptions = {},
): PersonalizationEngineBlueprint | null {
  if (!isBrainPersonalizationEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildPersonalizationEngineBlueprint(options)
}

export function assertPersonalizationEngineIsolation(): typeof PERSONALIZATION_ENGINE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...PERSONALIZATION_ENGINE_ISOLATION,
    architectureOnly: true,
    registrySize: listPersonalizationRegistry().length,
  }
}

export const PersonalizationEngine = {
  buildBlueprint: buildPersonalizationEngineBlueprint,
  tryBuildBlueprint: tryBuildPersonalizationEngineBlueprint,
  assertIsolation: assertPersonalizationEngineIsolation,
}
