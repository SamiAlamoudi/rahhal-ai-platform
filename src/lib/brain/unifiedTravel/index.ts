/**
 * Sprint 31 — Unified Travel Planning Engine public surface.
 */

export type {
  UnifiedTravelPlannerStage,
  UnifiedPlanOptimizationFactor,
  UnifiedTripCostEstimate,
  UnifiedItineraryDay,
  UnifiedFlightLeg,
  UnifiedHotelStay,
  UnifiedTravelPlanOption,
  UnifiedFollowUpQuestion,
  UnifiedTravelPlanResult,
  UnifiedTravelPlannerContext,
  UnifiedTravelPlannerOptions,
  UnifiedTravelPlannerRunInput,
  UnifiedPlanCandidate,
} from './types'

export { isUnifiedTravelPlannerEnabled } from './feature'

export {
  emptyUnifiedContext,
  extractContextFromUserText,
  mergeUnifiedContext,
  contextFromMemoryLike,
} from './context'

export {
  detectMissingUnifiedFields,
  buildUnifiedFollowUps,
} from './missingInfo'

export { estimateTripCost } from './cost'
export { buildUnifiedItinerary } from './itinerary'
export { pairFlightsAndHotels, scoreAndRankPlans } from './optimize'
export { searchUnifiedFlights, searchUnifiedHotels, toHotelStay } from './providers'

export {
  UnifiedTravelPlanner,
  getOrCreateUnifiedTravelPlanner,
  resetUnifiedTravelPlanner,
  type UnifiedTravelPlannerHandle,
} from './unifiedTravelPlanner'
