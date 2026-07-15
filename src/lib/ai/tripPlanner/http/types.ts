/**
 * Phase AG — Trip Planner API Layer transport types.
 * Thin HTTP envelopes around TripPlannerService (no second orchestration).
 */

import type { TripPlannerRequest, TripPlannerResult } from '../models'

export type TripPlannerApiAction = 'plan' | 'get_result' | 'health'

export interface TripPlannerAuthUser {
  id: string
  email?: string | null
  role?: string | null
}

export interface TripPlannerApiErrorBody {
  error: string
  code: string
  correlationId?: string
  details?: unknown
  retryable?: boolean
}

export interface TripPlannerPlanApiRequest {
  action?: 'plan'
  request: TripPlannerRequest
}

export interface TripPlannerGetResultApiRequest {
  action: 'get_result'
  idempotencyKey?: string
  requestId?: string
}

export type TripPlannerApiRequestBody =
  | TripPlannerPlanApiRequest
  | TripPlannerGetResultApiRequest
  | { action?: string }

export interface TripPlannerHealthResponse {
  status: 'ok'
  service: 'trip-planner'
  version: 1
  paymentProvider: 'mock'
  liveProvidersEnabled: false
  bookingEnabled: false
  ts: string
}

export interface TripPlannerPlanApiResponse {
  ok: true
  action: 'plan'
  result: TripPlannerResult
}

export interface TripPlannerGetResultApiResponse {
  ok: true
  action: 'get_result'
  result: TripPlannerResult | null
}

export type TripPlannerApiSuccessBody =
  | TripPlannerHealthResponse
  | TripPlannerPlanApiResponse
  | TripPlannerGetResultApiResponse
