/**
 * Phase AB — v1.1 AI Enhancement Foundation.
 * Additive library surface; no UI; no breaking TripPlan / ProviderAdapter changes.
 */

export {
  type FeatureLifecycle,
  type FeatureId,
  type FeatureDefinition,
  type FeatureRegistrySnapshot,
  FeatureRegistry,
  getFeatureRegistry,
  resetFeatureRegistry,
  createDefaultFeatureRegistry,
} from './featureFlags'

export {
  type TravelStyle,
  type TravelerPreferences,
  type HotelPreferences,
  type AirlinePreferences,
  type BudgetProfile,
  type TravelStyleProfile,
  type PreferenceWeights,
  type PersonalizationProfile,
  type PreferenceEngine,
  type PreferenceEngineOptions,
  defaultPreferenceWeights,
  emptyPersonalizationProfile,
  InMemoryPreferenceEngine,
  getPreferenceEngine,
  resetPreferenceEngine,
} from './preferences'

export {
  type RankableItem,
  type RankedItem,
  type RankingInput,
  type RankingEngine,
  DefaultRankingEngine,
  createRankingEngine,
} from './ranking'

export {
  type RecommendationCandidate,
  type RecommendationRequest,
  type RecommendationResult,
  type RecommendationEngine,
  DefaultRecommendationEngine,
  createRecommendationEngine,
} from './recommendations'

export {
  type MultiDestinationPlanInput,
  type MultiDestinationSegment,
  type MultiDestinationOutline,
  type AlternativeItineraryVariant,
  type ExplainableRecommendation,
  type PlanningConfidence,
  buildMultiDestinationOutline,
  generateAlternativeItineraries,
  scorePlanningConfidence,
  buildExplainableRecommendation,
  applyPreferenceWeighting,
  estimatePreferenceFit,
} from './planning'

export {
  type AnalyticsEventName,
  type AnalyticsEvent,
  type FunnelMetrics,
  type AnalyticsSnapshot,
  type AnalyticsRecorderOptions,
  type ProductAnalytics,
  InMemoryProductAnalytics,
  getProductAnalytics,
  resetProductAnalytics,
} from './analytics'
