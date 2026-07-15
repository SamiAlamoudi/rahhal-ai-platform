export type {
  MultiDestinationPlanInput,
  MultiDestinationSegment,
  MultiDestinationOutline,
  AlternativeItineraryVariant,
  ExplainableRecommendation,
  PlanningConfidence,
} from './types'
export {
  buildMultiDestinationOutline,
  generateAlternativeItineraries,
  scorePlanningConfidence,
  buildExplainableRecommendation,
  applyPreferenceWeighting,
  estimatePreferenceFit,
} from './planningEnhancements'
