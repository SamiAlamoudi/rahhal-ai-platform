/**
 * Sprint 111 — AI Concierge Experience (Decision Conversation Layer).
 * Sits AFTER Response Composer. Facts-only; never invents values.
 */

import type { ResponseComposerResult } from '../responseComposer/types'

export const SPRINT111_CONCIERGE_VERSION = '1.0.0-decision-concierge'

export type ConciergeTravelerPersona =
  | 'family'
  | 'business'
  | 'leisure'
  | 'luxury'
  | 'budget'
  | 'general'

export type ConciergeTradeoffKind =
  | 'cheaper_longer'
  | 'expensive_better_timing'
  | 'fewer_layovers'
  | 'better_hotel'
  | 'higher_confidence'
  | 'cheaper'
  | 'faster'
  | 'more_expensive'
  | 'longer'
  | 'other'

export type ConciergeScenarioKind =
  | 'travel_one_day_earlier'
  | 'increase_budget'
  | 'reduce_budget'
  | 'upgrade_hotel'
  | 'direct_flight_only'
  | 'family_travelers'
  | 'business_travelers'

/** Normalized recommendation option from Decision Engine / Response Composer / Trip Builder. */
export interface ConciergeRecommendationOption {
  id: string
  title: string | null
  price: number | null
  currency: string
  durationMinutes: number | null
  stops: number | null
  cabin: string | null
  airline: string | null
  hotelName: string | null
  hotelStars: number | null
  confidence: number | null
  score: number | null
  kind: string | null
  reason: string | null
  labels: string[]
}

export interface ConciergeInput {
  conversationId?: string | null
  /** Selected / primary option id. Defaults to first recommendation. */
  selectedId?: string | null
  recommendations?: ConciergeRecommendationOption[] | null
  decisionConfidence?: number | null
  decisionExplanation?: string | null
  budget?: number | null
  currency?: string | null
  travelerType?: ConciergeTravelerPersona | null
  destination?: string | null
  /**
   * Optional Response Composer result — Concierge may consume it.
   * Response Composer itself is not modified.
   */
  responseComposer?: ResponseComposerResult | null
}

export interface ConciergeExplanation {
  whySelected: string
  strengths: string[]
  weaknesses: string[]
  bestFor: string
  reasoningSummary: string
}

export interface ConciergeTradeoff {
  kind: ConciergeTradeoffKind
  label: string
  againstOptionId: string
  againstTitle: string | null
  summary: string
  selectedAdvantage: string | null
  alternativeAdvantage: string | null
  priceDelta: number | null
  durationDeltaMinutes: number | null
  stopsDelta: number | null
  confidenceDelta: number | null
}

export interface ConciergeScenario {
  kind: ConciergeScenarioKind
  label: string
  applicable: boolean
  summary: string
  matchingOptionIds: string[]
  estimatedPrice: number | null
  currency: string
  notes: string[]
}

export interface ConciergeSavingsAnalysis {
  selectedPrice: number | null
  cheapestPrice: number | null
  potentialSavingsVsSelected: number | null
  potentialSavingsVsBudget: number | null
  priceDifferenceToPremium: number | null
  valueImprovementNotes: string[]
  confidenceImpactNotes: string[]
  currency: string
  summary: string
}

export interface ConciergeNarrative {
  primary: string
  alternatives: string[]
  closing: string | null
}

export interface ConciergeConversationMetadata {
  confidence: number
  reasoningSummary: string
  tradeoffs: ConciergeTradeoff[]
  warnings: string[]
  highlights: string[]
  bestFor: string
  costSummary: string
  qualitySummary: string
}

export interface ConciergeResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  conversationId: string
  selected: ConciergeRecommendationOption | null
  explanation: ConciergeExplanation | null
  tradeoffs: ConciergeTradeoff[]
  scenarios: ConciergeScenario[]
  savings: ConciergeSavingsAnalysis | null
  narrative: ConciergeNarrative | null
  metadata: ConciergeConversationMetadata
  /**
   * Optional attachment for Response Composer consumers (RC unchanged).
   * Callers may merge these strings into presentation.
   */
  responseComposerAttachment: {
    narrativeLines: string[]
    highlights: string[]
    warnings: string[]
    confidence: number
  }
  validationErrors: string[]
  logs: string[]
  latencyMs: number
}

export interface ConciergeLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export type ConciergeStructuredLogger = (entry: ConciergeLogEntry) => void

export function createSilentConciergeLogger(): ConciergeStructuredLogger {
  return () => {
    /* logs retained on runner */
  }
}
