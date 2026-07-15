/**
 * Phase AG — Trip Planner HTTP API surface.
 */

export type {
  TripPlannerApiAction,
  TripPlannerApiErrorBody,
  TripPlannerApiRequestBody,
  TripPlannerApiSuccessBody,
  TripPlannerAuthUser,
  TripPlannerGetResultApiRequest,
  TripPlannerGetResultApiResponse,
  TripPlannerHealthResponse,
  TripPlannerPlanApiRequest,
  TripPlannerPlanApiResponse,
} from './types'

export {
  extractBearerToken,
  createDevTokenAuthResolver,
  createSupabaseJwtAuthResolver,
  assertUserOwnsRequest,
  type TripPlannerAuthResolver,
} from './auth'

export {
  handleTripPlannerHttpRequest,
  createTripPlannerHttpHandler,
  type TripPlannerHttpHandlerOptions,
} from './handler'

export type {
  CreateTripPlanRequestDto,
  CreateTripPlanResponseDto,
  TripPlanErrorDto,
  TripPlanResultDto,
  TripPlanStatusDto,
  TripPlanTimelineDto,
  TripPlanApiStatus,
} from './dto'

export {
  toTripPlanResultDto,
  toTimelineDto,
  dtoToTripPlannerRequest,
  sanitizeCreateDto,
} from './dto'

export {
  progressForStage,
  progressFromTimeline,
} from './progress'

export {
  TripPlannerPlanStore,
  hashTripPlanRequest,
  planProgress,
  isRetryablePlan,
} from './planStore'

export {
  handleTripPlannerRestRequest,
  isTripPlannerRestPath,
  createPlanStore,
} from './restRouter'

export {
  getTripPlannerApiMetrics,
  resetTripPlannerApiMetrics,
  TripPlannerApiMetrics,
} from './apiMetrics'

export {
  buildErrorBody,
  localizeApiError,
  mapValidationCodeToApi,
} from './errors'
