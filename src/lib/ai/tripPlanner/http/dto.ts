/**
 * Phase AG — stable API DTOs (separate from internal domain models).
 */

import type {
  BookingPreview,
  PipelineConfidence,
  TripPlannerPipelineEvent,
  TripPlannerRequest,
  TripPlannerResult,
  TripPlannerStage,
  TripPlannerStatus,
  TripPlannerValidationError,
} from '../models'
import { maskMetadata } from '../../../ops/logging/mask'

/** Public plan lifecycle including in-flight states for async executions. */
export type TripPlanApiStatus =
  | TripPlannerStatus
  | 'accepted'
  | 'queued'
  | 'running'

export interface CreateTripPlanRequestDto {
  destinations: string[]
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  flexibleDates?: boolean
  durationDays?: number | null
  travelers: TripPlannerRequest['travelers']
  budget?: TripPlannerRequest['budget']
  currency?: string | null
  travelStyle?: string | null
  explicitPreferences?: TripPlannerRequest['explicitPreferences']
  constraints?: TripPlannerRequest['constraints']
  accessibilityNeeds?: TripPlannerRequest['accessibilityNeeds']
  preferredLanguage?: 'ar' | 'en' | null
  includeBookingPreview?: boolean
  expiresAt?: string | null
  inferredPreferences?: TripPlannerRequest['inferredPreferences']
  requestId?: string
  /**
   * Never trusted for ownership. Stripped at the boundary; authenticated user wins.
   * @deprecated Do not send.
   */
  userId?: string
  /** Ignored when Idempotency-Key header is present. */
  idempotencyKey?: string
}

export interface TripPlanErrorDto {
  error: {
    code: string
    message: string
    field?: string
    retryable: boolean
    correlationId: string
  }
}

export interface CreateTripPlanResponseDto {
  planId: string
  status: TripPlanApiStatus
  currentStage: TripPlannerStage
  progress: number
  correlationId: string
  statusUrl: string
  resultUrl: string
  result?: TripPlanResultDto | null
}

export interface TripPlanStatusDto {
  planId: string
  status: TripPlanApiStatus
  currentStage: TripPlannerStage
  progress: number
  startedAt: string
  updatedAt: string
  completedAt: string | null
  retryable: boolean
  correlationId: string
}

export interface TripPlanTimelineEventDto {
  id: string
  stage: TripPlannerStage
  at: string
  message: string
  ok: boolean
  durationMs?: number | null
  details?: Record<string, unknown>
}

export interface TripPlanTimelineDto {
  planId: string
  events: TripPlanTimelineEventDto[]
}

export interface TripPlanResultDto {
  planId: string
  requestId: string
  userId: string
  correlationId: string
  status: TripPlannerStatus
  stage: TripPlannerStage
  progress: number
  recommendations: TripPlannerResult['recommendations']
  itinerary: TripPlannerResult['itinerary']
  bookingPreview: BookingPreview | null
  totalEstimatedCost: number | null
  currency: string
  overallConfidence: number
  confidence: PipelineConfidence | null
  warnings: string[]
  assumptions: string[]
  validationErrors: TripPlannerValidationError[]
  failure: TripPlannerResult['failure']
  partial: boolean
  generatedAt: string
  version: 1
}

export function toTripPlanResultDto(
  planId: string,
  result: TripPlannerResult,
  progress: number,
): TripPlanResultDto {
  return {
    planId,
    requestId: result.requestId,
    userId: result.userId,
    correlationId: result.correlationId,
    status: result.status,
    stage: result.stage,
    progress,
    recommendations: result.recommendations,
    itinerary: result.itinerary,
    bookingPreview: result.bookingPreview,
    totalEstimatedCost: result.totalEstimatedCost,
    currency: result.currency,
    overallConfidence: result.overallConfidence,
    confidence: result.confidence,
    warnings: result.warnings,
    assumptions: result.assumptions,
    validationErrors: result.validationErrors,
    failure: result.failure
      ? {
          stage: result.failure.stage,
          code: result.failure.code,
          message: result.failure.message,
          retryable: result.failure.retryable,
          correlationId: result.failure.correlationId,
        }
      : null,
    partial: result.partial,
    generatedAt: result.generatedAt,
    version: 1,
  }
}

export function toTimelineDto(
  planId: string,
  events: TripPlannerPipelineEvent[],
): TripPlanTimelineDto {
  return {
    planId,
    events: events.map((e) => ({
      id: e.id,
      stage: e.stage,
      at: e.at,
      message: e.message,
      ok: e.ok,
      durationMs: e.durationMs ?? null,
      details: e.details
        ? (maskMetadata(e.details) as Record<string, unknown>)
        : undefined,
    })),
  }
}

export function dtoToTripPlannerRequest(
  dto: CreateTripPlanRequestDto,
  authenticatedUserId: string,
  idempotencyKey: string,
): TripPlannerRequest {
  return {
    requestId: dto.requestId?.trim() || `req_${idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}`,
    userId: authenticatedUserId,
    destinations: Array.isArray(dto.destinations) ? dto.destinations : [],
    origin: dto.origin ?? null,
    startDate: dto.startDate ?? null,
    endDate: dto.endDate ?? null,
    flexibleDates: dto.flexibleDates === true,
    durationDays: dto.durationDays ?? null,
    travelers: dto.travelers,
    budget: dto.budget ?? null,
    currency: dto.currency ?? null,
    travelStyle: dto.travelStyle ?? null,
    explicitPreferences: dto.explicitPreferences ?? null,
    constraints: dto.constraints ?? null,
    accessibilityNeeds: dto.accessibilityNeeds ?? null,
    preferredLanguage: dto.preferredLanguage ?? null,
    includeBookingPreview: dto.includeBookingPreview === true,
    idempotencyKey,
    expiresAt: dto.expiresAt ?? null,
    inferredPreferences: dto.inferredPreferences ?? null,
  }
}

/** Strip mass-assignment / payment fields from client JSON. */
export function sanitizeCreateDto(raw: unknown): CreateTripPlanRequestDto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if ('payment' in o || 'paymentMethod' in o || 'cardNumber' in o || 'cvv' in o) {
    // Reject payment details on these endpoints.
    return null
  }
  const travelers = o.travelers
  if (!travelers || typeof travelers !== 'object') return null

  return {
    destinations: Array.isArray(o.destinations)
      ? o.destinations.filter((d): d is string => typeof d === 'string')
      : [],
    origin: typeof o.origin === 'string' || o.origin === null ? (o.origin as string | null) : null,
    startDate:
      typeof o.startDate === 'string' || o.startDate === null
        ? (o.startDate as string | null)
        : null,
    endDate:
      typeof o.endDate === 'string' || o.endDate === null ? (o.endDate as string | null) : null,
    flexibleDates: o.flexibleDates === true,
    durationDays:
      typeof o.durationDays === 'number' || o.durationDays === null
        ? (o.durationDays as number | null)
        : null,
    travelers: travelers as TripPlannerRequest['travelers'],
    budget: (o.budget as TripPlannerRequest['budget']) ?? null,
    currency: typeof o.currency === 'string' || o.currency === null ? (o.currency as string | null) : null,
    travelStyle:
      typeof o.travelStyle === 'string' || o.travelStyle === null
        ? (o.travelStyle as string | null)
        : null,
    explicitPreferences:
      (o.explicitPreferences as TripPlannerRequest['explicitPreferences']) ?? null,
    constraints: (o.constraints as TripPlannerRequest['constraints']) ?? null,
    accessibilityNeeds:
      (o.accessibilityNeeds as TripPlannerRequest['accessibilityNeeds']) ?? null,
    preferredLanguage:
      typeof o.preferredLanguage === 'string' || o.preferredLanguage === null
        ? (o.preferredLanguage as CreateTripPlanRequestDto['preferredLanguage'])
        : undefined,
    includeBookingPreview: o.includeBookingPreview === true,
    expiresAt:
      typeof o.expiresAt === 'string' || o.expiresAt === null
        ? (o.expiresAt as string | null)
        : null,
    inferredPreferences:
      (o.inferredPreferences as TripPlannerRequest['inferredPreferences']) ?? null,
    requestId: typeof o.requestId === 'string' ? o.requestId : undefined,
  }
}
