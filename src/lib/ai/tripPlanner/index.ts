/**
 * Phase AF — Unified AI Trip Planner Pipeline v1 public surface.
 */

export type {
  BookingPreview,
  PipelineConfidence,
  PipelineNormalizedPreferences,
  PreferenceSourceRecord,
  PreferredLanguage,
  SupportedTripCurrency,
  TripPlannerAccessibilityNeeds,
  TripPlannerBudget,
  TripPlannerConstraints,
  TripPlannerExplicitPreferences,
  TripPlannerFailure,
  TripPlannerPipelineEvent,
  TripPlannerRequest,
  TripPlannerResult,
  TripPlannerStage,
  TripPlannerStatus,
  TripPlannerTimeouts,
  TripPlannerTravelers,
  TripPlannerTravelerType,
  TripPlannerValidationError,
} from './models'
export {
  DEFAULT_TRIP_PLANNER_TIMEOUTS,
  SUPPORTED_TRIP_CURRENCIES,
} from './models'

export {
  validateTripPlannerRequest,
  resolveCurrency,
  resolveDurationDays,
} from './validation'

export { buildRecommendationCandidates } from './candidates'
export { calculatePipelineConfidence } from './confidence'

export type {
  PipelineExecutionState,
  TripPlannerExecutionRepository,
  TripPlannerEventRepository,
  TripPlannerResultRepository,
} from './repository'
export {
  InMemoryTripPlannerExecutionRepository,
  InMemoryTripPlannerEventRepository,
  InMemoryTripPlannerResultRepository,
} from './repository'

export type { TripPlannerMetricName, TripPlannerMetrics } from './metrics'
export {
  InMemoryTripPlannerMetrics,
  getTripPlannerMetrics,
  resetTripPlannerMetrics,
} from './metrics'

export type {
  TripPlannerFailStage,
  TripPlannerServiceOptions,
} from './tripPlannerService'
export {
  TripPlannerService,
  createTripPlannerService,
  resetTripPlannerCounters,
  resetTripPlannerTestSingletons,
} from './tripPlannerService'
