/**
 * Evolution Sprint 7 — Destination Intelligence Layer (additive).
 * Default OFF via `ai.destination_intelligence`. Not wired into planTurn.
 */

export type {
  DestinationLocale,
  CrowdLevel,
  SafetyBand,
  CostBand,
  VisaBand,
  SeasonQuality,
  MonthlyClimateNote,
  DestinationKnowledgeRecord,
  DestinationProfileView,
  DestinationDna,
  TravelerMatchInput,
  DestinationSnapshot,
  DestinationComparisonResult,
  DestinationEngineInput,
} from './destinationTypes'

export {
  clamp01,
  clampScore,
  isoNow,
  uniqueStrings,
} from './destinationTypes'

export {
  DESTINATION_INTELLIGENCE_FEATURE_ID,
  isDestinationIntelligenceEnabled,
} from './destinationFeature'

export {
  DestinationKnowledge,
  DESTINATION_KNOWLEDGE,
  findDestinationKnowledge,
  listDestinationKnowledge,
} from './destinationKnowledge'

export {
  DestinationProfile,
  toDestinationProfile,
  resolveDestinationProfile,
} from './destinationProfile'

export {
  ClimateAnalyzer,
  SeasonAnalyzer,
  CrowdAnalyzer,
  SafetyAnalyzer,
  TransportationAnalyzer,
  FamilySuitability,
  LuxurySuitability,
  AdventureSuitability,
  FoodCultureAnalyzer,
  ShoppingAnalyzer,
  NatureAnalyzer,
  CityAnalyzer,
  NightlifeAnalyzer,
  PhotographyAnalyzer,
  AccessibilityAnalyzer,
  LocalEventsAnalyzer,
  BudgetSuitability,
  VisaComplexity,
  analyzeClimate,
  analyzeSeason,
  analyzeCrowd,
  analyzeSafety,
  analyzeTransportation,
  analyzeFamilySuitability,
  analyzeLuxurySuitability,
  analyzeAdventureSuitability,
  analyzeFoodCulture,
  analyzeShopping,
  analyzeNature,
  analyzeCity,
  analyzeNightlife,
  analyzePhotography,
  analyzeAccessibility,
  analyzeLocalEvents,
  analyzeBudgetSuitability,
  analyzeVisaComplexity,
} from './destinationAnalyzers'

export {
  DestinationConfidence,
  DestinationSummary,
  destinationConfidence,
  buildDestinationDna,
  buildDestinationSnapshot,
  matchTravelerScore,
  whoShouldAvoid,
  bestTravelerMatch,
} from './destinationSummary'

export {
  DestinationComparator,
  compareDestinations,
} from './destinationComparator'

export {
  DestinationIntelligence,
  runDestinationIntelligence,
  tryRunDestinationIntelligence,
} from './destinationEngine'
export type { DestinationEngineResult } from './destinationEngine'
