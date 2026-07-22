/**
 * Sprint 106 — AI Response Composer contracts.
 * Presentation only — converts provider / decision facts into conversational structure.
 */

export const SPRINT106_RESPONSE_COMPOSER_VERSION = '1.0.0-response-composer'

export type ResponseRecommendationKind =
  | 'best_overall'
  | 'cheapest'
  | 'fastest'
  | 'best_value'
  | 'premium'
  | 'most_comfortable'
  | 'business'
  | 'flexible'

export type ResponseInsightKind =
  | 'visa_reminder'
  | 'time_difference'
  | 'arrival_time'
  | 'night_arrival'
  | 'short_connection'
  | 'long_layover'
  | 'peak_travel'
  | 'weather_reminder'
  | 'airport_transfer'
  | 'travel_tip'

export type ResponseWarningKind =
  | 'booking'
  | 'fare'
  | 'layover'
  | 'night_arrival'
  | 'short_connection'
  | 'empty_results'
  | 'incomplete_data'
  | 'provider'

export interface ResponseComposerFlightFacts {
  id: string
  providerId?: string | null
  title?: string | null
  airline?: string | null
  origin?: string | null
  destination?: string | null
  price?: number | null
  currency?: string | null
  durationMinutes?: number | null
  stops?: number | null
  layoverMinutes?: number | null
  cabin?: string | null
  departureAt?: string | null
  arrivalAt?: string | null
  departureHour?: number | null
  arrivalHour?: number | null
  refundable?: boolean | null
  baggageIncluded?: boolean | null
  seatsRemaining?: number | null
  score?: number | null
}

export interface ResponseComposerTripContext {
  origin?: string | null
  destination?: string | null
  departureDate?: string | null
  returnDate?: string | null
  travelers?: number | null
  currency?: string | null
  /** Optional hours offset destination − origin (only when known). */
  timeDifferenceHours?: number | null
  /** Optional visa reminder text from known destination policy (never invented). */
  visaNote?: string | null
}

export interface ResponseComposerInput {
  conversationId?: string | null
  trip?: ResponseComposerTripContext | null
  /** Normalized flight offers from gateway / live search / decision candidates. */
  flights?: ResponseComposerFlightFacts[] | null
  /** Optional Decision Engine recommendation confidence (0–1). */
  decisionConfidence?: number | null
  /** Optional Decision Engine explanation string (pass-through only). */
  decisionExplanation?: string | null
  /** Pre-labeled picks from Decision Engine when available. */
  labeled?: {
    bestOverallId?: string | null
    cheapestId?: string | null
    fastestId?: string | null
    bestComfortId?: string | null
    bestValueId?: string | null
  } | null
}

export interface ResponseRecommendation {
  kind: ResponseRecommendationKind
  label: string
  optionId: string | null
  title: string | null
  price: number | null
  currency: string
  durationMinutes: number | null
  stops: number | null
  cabin: string | null
  airline: string | null
  reason: string
  reasons: string[]
  highlights: string[]
}

export interface ResponseAlternativeGroup {
  kind: ResponseRecommendationKind
  label: string
  recommendations: ResponseRecommendation[]
}

export interface ResponseInsight {
  kind: ResponseInsightKind
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
}

export interface ResponseWarning {
  kind: ResponseWarningKind
  code: string
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export interface ResponseConfidenceBreakdown {
  overall: number
  level: 'high' | 'medium' | 'low'
  label: string
  priceConfidence: number
  scheduleConfidence: number
  recommendationConfidence: number
  explanations: string[]
}

export interface ResponseSummarySection {
  headline: string
  executiveSummary: string
  bestRecommendationLabel: string | null
  keyPoints: string[]
}

export interface ResponseComposerResult {
  version: string
  enabled: boolean
  conversationId: string
  summary: ResponseSummarySection
  recommendations: ResponseRecommendation[]
  alternatives: ResponseAlternativeGroup[]
  insights: ResponseInsight[]
  warnings: ResponseWarning[]
  confidence: ResponseConfidenceBreakdown
  metadata: {
    offerCount: number
    validOfferCount: number
    durationMs: number
    empty: boolean
    source: 'provider_offers' | 'empty' | 'disabled'
  }
}

export interface ResponseComposerLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}
