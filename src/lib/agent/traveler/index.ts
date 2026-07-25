/**
 * Evolution Sprint 5 — Traveler Intelligence Layer (additive).
 * Default OFF via `ai.traveler_intelligence`. Not wired into planTurn.
 */

export type {
  TravelerLocale,
  PreferenceKey,
  PreferencePolarity,
  PreferenceEvidenceItem,
  PreferenceSignal,
  StoredPreference,
  TravelerProfileSnapshot,
  TravelDna,
  TravelerPersonality,
  PlanningBias,
  RecommendationBias,
  TravelerSnapshot,
  TravelerModelState,
  TravelerObserveInput,
} from './travelerTypes'

export {
  isoNow,
  newId,
  clamp01,
  clampLean,
  uniqueStrings,
  ALL_PREFERENCE_KEYS,
} from './travelerTypes'

export {
  TRAVELER_INTELLIGENCE_FEATURE_ID,
  isTravelerIntelligenceEnabled,
} from './travelerFeature'

export { PreferenceEvidence, createEvidence, mergeEvidence } from './preferenceEvidence'
export { PreferenceEvolution, evolvePreference, evolveMany } from './preferenceEvolution'
export { TravelerConfidence, overallTravelerConfidence, recordConfidencePoint } from './travelerConfidence'
export { TravelerProfile, createEmptyProfile, updateProfileFromText } from './travelerProfile'
export {
  TravelerPreferenceModel,
  listPreferences,
  getPreference,
  preferencesAbove,
} from './travelerPreferenceModel'
export {
  TravelerSummary,
  buildTravelDna,
  buildPersonality,
  buildPlanningBias,
  buildRecommendationBias,
  buildTravelerSnapshot,
  buildSummaryText,
} from './travelerSummary'
export {
  TravelerModel,
  createTravelerModel,
  tryCreateTravelerModel,
  observeTraveler,
  tryObserveTraveler,
} from './travelerModel'

export { BehaviorAnalyzer, analyzeBehavior } from './behaviorAnalyzer'
export { TravelStyleAnalyzer, analyzeTravelStyle } from './travelStyleAnalyzer'
export { BudgetBehaviorAnalyzer, analyzeBudgetBehavior } from './budgetBehaviorAnalyzer'
export { RiskToleranceAnalyzer, analyzeRiskTolerance } from './riskToleranceAnalyzer'
export { ComfortAnalyzer, analyzeComfort } from './comfortAnalyzer'
export { PaceAnalyzer, analyzePace } from './paceAnalyzer'
export { FoodPreferenceAnalyzer, analyzeFoodPreference } from './foodPreferenceAnalyzer'
export { ActivityPreferenceAnalyzer, analyzeActivityPreference } from './activityPreferenceAnalyzer'
export { SeasonPreferenceAnalyzer, analyzeSeasonPreference } from './seasonPreferenceAnalyzer'
export { DestinationAffinity, analyzeDestinationAffinity } from './destinationAffinity'
export { analyzeWalkingAndTransit } from './mobilityAnalyzers'
export { analyzeSocialAndMedia } from './socialAnalyzers'
export { analyzeDecisionConfidence } from './decisionConfidenceAnalyzer'
