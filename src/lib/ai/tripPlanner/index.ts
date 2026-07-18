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

export {
  type TripPlannerApiAction,
  type TripPlannerApiErrorBody,
  type TripPlannerApiRequestBody,
  type TripPlannerApiSuccessBody,
  type TripPlannerAuthUser,
  type TripPlannerAuthResolver,
  type TripPlannerHttpHandlerOptions,
  type CreateTripPlanRequestDto,
  type CreateTripPlanResponseDto,
  type TripPlanResultDto,
  type TripPlanStatusDto,
  type TripPlanTimelineDto,
  type TripPlanErrorDto,
  extractBearerToken,
  createDevTokenAuthResolver,
  createSupabaseJwtAuthResolver,
  assertUserOwnsRequest,
  handleTripPlannerHttpRequest,
  createTripPlannerHttpHandler,
  progressForStage,
  progressFromTimeline,
  TripPlannerPlanStore,
  getTripPlannerApiMetrics,
  resetTripPlannerApiMetrics,
  handleTripPlannerRestRequest,
} from './http'

export {
  mapTravelSessionToTripPlannerRequest,
  adaptTripPlannerResultToSearchOrchestration,
  adaptReasoningMap,
  localizeValidationErrors,
  formatApiTransportError,
  runTripPlannerFlow,
  STAGE_LABELS_AR,
  STAGE_LABELS_EN,
} from './frontend'
