/**
 * Sprint 96 — AI Concierge Experience contracts.
 * Presentation / explanation only — no engine redesign.
 */

export const SPRINT96_AI_CONCIERGE_VERSION = '1.0.0-ai-concierge'

/** Product-facing recommendation reasoning timeline. */
export type ConciergeTimelineStageId =
  | 'searching'
  | 'comparing'
  | 'ranking'
  | 'optimizing'
  | 'final_recommendation'

export type ConciergeTimelineStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'

export interface ConciergeTimelineStage {
  id: ConciergeTimelineStageId
  label: string
  status: ConciergeTimelineStatus
  message: string
  progressPercent: number
  startedAt: string | null
  completedAt: string | null
  durationMs: number
}

export interface ConciergeRecommendationTimeline {
  stages: ConciergeTimelineStage[]
  currentStageId: ConciergeTimelineStageId | null
  progressPercent: number
  startedAt: string
  completedAt: string | null
  durationMs: number
}

export type ConciergeConfidenceLevel = 'high' | 'medium' | 'low'

export interface ConciergeConfidenceIndicator {
  score: number
  level: ConciergeConfidenceLevel
  label: string
  uncertaintyExplanation: string | null
  factors: string[]
}

export interface ConciergeExplanation {
  whyDestination: string
  whyFlights: string
  whyHotel: string
  whyPackage: string
  whyTiming: string
  summary: string
}

export type ConciergeScenarioKind =
  | 'best_price'
  | 'best_comfort'
  | 'fastest'
  | 'best_value'
  | 'luxury'
  | 'family_friendly'

export interface ConciergeAlternativeScenario {
  kind: ConciergeScenarioKind
  label: string
  estimatedCost: number | null
  currency: string
  confidence: number
  explanation: string
  highlights: string[]
  optionId: string | null
}

export interface ConciergeComparisonCard {
  optionId: string
  title: string
  price: number | null
  currency: string
  durationMinutes: number | null
  stops: number | null
  hotelQuality: string | null
  overallValue: number
  recommendationReason: string
  isRecommended: boolean
}

export type ConciergeSuggestionKind =
  | 'travel_insurance'
  | 'airport_transfer'
  | 'visa_reminder'
  | 'weather'
  | 'packing_tips'
  | 'local_transportation'

export interface ConciergeSuggestion {
  kind: ConciergeSuggestionKind
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  actionable: boolean
}

export interface ConciergeConversationSummary {
  text: string
  recommendedOptionLabel: string | null
  keyReasons: string[]
  nextStep: string | null
}

export interface ConciergeTripFacts {
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  durationDays?: number | null
  travelers?: number | null
  travelerType?: string | null
  budgetAmount?: number | null
  currency?: string | null
  interests?: string[]
  mission?: string | null
}

export interface ConciergeOfferFacts {
  flights?: Array<{
    id: string
    airline?: string | null
    origin?: string | null
    destination?: string | null
    price?: number | null
    currency?: string | null
    durationMinutes?: number | null
    stops?: number | null
    cabin?: string | null
  }>
  hotels?: Array<{
    id: string
    name?: string | null
    price?: number | null
    currency?: string | null
    stars?: number | null
    rating?: number | null
  }>
  packages?: Array<{
    id: string
    title?: string | null
    totalPrice?: number | null
    currency?: string | null
    confidence?: number | null
    labels?: string[]
    explanation?: string | null
  }>
  decision?: {
    explanation?: string | null
    confidence?: number | null
    bestOverallId?: string | null
    bestBudgetId?: string | null
    fastestId?: string | null
    bestComfortId?: string | null
  } | null
  priceTimingNote?: string | null
  priceConfidence?: number | null
}

export interface ConciergeComposeRequest {
  conversationId?: string
  iteration?: number
  trip: ConciergeTripFacts
  offers?: ConciergeOfferFacts
  /** Optional prior confidence score 0–1 from engines. */
  engineConfidence?: number | null
}

export interface ConciergeExperienceResult {
  version: string
  conversationId: string
  timeline: ConciergeRecommendationTimeline
  explanation: ConciergeExplanation
  alternatives: ConciergeAlternativeScenario[]
  confidence: ConciergeConfidenceIndicator
  comparisonCards: ConciergeComparisonCard[]
  suggestions: ConciergeSuggestion[]
  conversationSummary: ConciergeConversationSummary
  durationMs: number
}
