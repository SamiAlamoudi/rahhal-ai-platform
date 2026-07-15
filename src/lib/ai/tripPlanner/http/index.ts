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
