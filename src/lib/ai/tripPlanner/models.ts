/**
 * Phase AF — Unified AI Trip Planner Pipeline v1 models.
 * Application-level orchestration contracts only; engines remain independent.
 */

import type { NormalizedPreferences } from '../preferences/preferenceEngine'
import type { Recommendation } from '../recommendations/models'
import type { Itinerary } from '../itinerary/models'
import type { BookingSummary, BookingTimeline } from '../booking/models'

export type TripPlannerStage =
  | 'Received'
  | 'Validating'
  | 'PreferencesPrepared'
  | 'RecommendationsGenerated'
  | 'ItineraryGenerated'
  | 'BookingPreviewGenerated'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'

export type TripPlannerStatus =
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'

export type PreferredLanguage = 'ar' | 'en'

export type TripPlannerTravelerType =
  | 'solo'
  | 'couple'
  | 'family'
  | 'friends'
  | 'business'

export interface TripPlannerTravelers {
  adults: number
  children?: number
  infants?: number
  travelerType?: TripPlannerTravelerType | null
}

export interface TripPlannerBudget {
  amount: number
  currency?: string
}

export interface TripPlannerConstraints {
  mustAvoid?: string[]
  maxActivitiesPerDay?: number
  preferDirectFlights?: boolean
  preferCentralHotels?: boolean
  /** Mutually exclusive with preferPackedSchedule when both true. */
  preferRelaxedPace?: boolean
  preferPackedSchedule?: boolean
  maxFlightStops?: number
}

export interface TripPlannerAccessibilityNeeds {
  wheelchairAccessible?: boolean
  reducedMobility?: boolean
  visualAssistance?: boolean
  hearingAssistance?: boolean
  notes?: string | null
}

export interface TripPlannerExplicitPreferences {
  travelerType?: TripPlannerTravelerType | null
  interests?: string[]
  budgetStyle?: 'luxury' | 'midrange' | 'budget' | null
  travelStyle?: string | null
  pace?: 'relaxed' | 'balanced' | 'packed' | null
  preferDirectFlights?: boolean
  preferCentralHotels?: boolean
  preferBreakfast?: boolean
  preferredAirlines?: string[]
  hotelCategories?: Array<'budget' | 'midrange' | 'boutique' | 'luxury'>
}

export interface TripPlannerRequest {
  requestId: string
  userId: string
  destinations: string[]
  origin?: string | null
  /** ISO date YYYY-MM-DD; optional when flexibleDates=true. */
  startDate?: string | null
  endDate?: string | null
  /** When true, dates may be omitted; durationDays drives planning. */
  flexibleDates?: boolean
  durationDays?: number | null
  travelers: TripPlannerTravelers
  budget?: TripPlannerBudget | null
  currency?: string | null
  travelStyle?: string | null
  explicitPreferences?: TripPlannerExplicitPreferences | null
  constraints?: TripPlannerConstraints | null
  accessibilityNeeds?: TripPlannerAccessibilityNeeds | null
  preferredLanguage?: PreferredLanguage | null
  /** When true, prepare mock booking preview (no payment / no confirm). */
  includeBookingPreview?: boolean
  idempotencyKey: string
  /** Optional client-supplied expiry for stale-request protection (ISO). */
  expiresAt?: string | null
  /** Optional inferred preference signals (non-PII). */
  inferredPreferences?: {
    frequentDestinations?: string[]
    interestSignals?: string[]
    typicalSpend?: number | null
  } | null
}

export interface TripPlannerPipelineEvent {
  id: string
  stage: TripPlannerStage
  at: string
  message: string
  ok: boolean
  durationMs?: number | null
  details?: Record<string, unknown>
}

export interface PreferenceSourceRecord {
  key: string
  source: 'explicit' | 'inferred' | 'default'
}

export interface PipelineNormalizedPreferences extends NormalizedPreferences {
  preferenceSources: PreferenceSourceRecord[]
}

export interface BookingPreview {
  bookingId: string
  state: string
  validated: boolean
  reservationReady: boolean
  paymentCaptured: false
  bookingConfirmed: false
  liveProvidersUsed: false
  summary: BookingSummary
  timeline: BookingTimeline
}

export interface PipelineConfidence {
  overall: number
  recommendation: number
  itinerary: number
  dataCompleteness: number
  constraintSatisfaction: number
  bookingPreviewReadiness: number | null
  notes: string[]
}

export interface TripPlannerValidationError {
  code: string
  message: string
  field?: string
}

export interface TripPlannerFailure {
  stage: TripPlannerStage
  code: string
  message: string
  retryable: boolean
  correlationId: string
}

export interface TripPlannerResult {
  requestId: string
  /** Owning user id (additive; used by API authz). */
  userId: string
  correlationId: string
  status: TripPlannerStatus
  stage: TripPlannerStage
  normalizedPreferences: PipelineNormalizedPreferences | null
  recommendations: Recommendation[]
  itinerary: Itinerary | null
  bookingPreview: BookingPreview | null
  totalEstimatedCost: number | null
  currency: string
  overallConfidence: number
  confidence: PipelineConfidence | null
  warnings: string[]
  assumptions: string[]
  pipelineTimeline: TripPlannerPipelineEvent[]
  failure: TripPlannerFailure | null
  validationErrors: TripPlannerValidationError[]
  partial: boolean
  generatedAt: string
  version: 1
}

export interface TripPlannerTimeouts {
  /** Total pipeline budget in ms. */
  totalMs: number
  validatingMs: number
  preferencesMs: number
  recommendationsMs: number
  itineraryMs: number
  bookingPreviewMs: number
}

export const DEFAULT_TRIP_PLANNER_TIMEOUTS: TripPlannerTimeouts = {
  totalMs: 30_000,
  validatingMs: 2_000,
  preferencesMs: 2_000,
  recommendationsMs: 8_000,
  itineraryMs: 8_000,
  bookingPreviewMs: 8_000,
}

export const SUPPORTED_TRIP_CURRENCIES = [
  'USD',
  'SAR',
  'EUR',
  'AED',
  'GBP',
] as const

export type SupportedTripCurrency = (typeof SUPPORTED_TRIP_CURRENCIES)[number]
