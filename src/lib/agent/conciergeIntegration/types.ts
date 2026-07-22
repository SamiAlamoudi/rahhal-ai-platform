/**
 * Sprint 97 — UI-ready Concierge DTOs (presentation only).
 * Additive — does not replace legacy conversation contracts.
 */

import type { AgentConciergeExperienceMeta } from '../conciergeExperience'

export const SPRINT97_CONCIERGE_INTEGRATION_VERSION = '1.0.0-concierge-integration'

export interface ConciergeTimelineStageDto {
  id: string
  label: string
  status: string
  message: string
  progressPercent: number
}

export interface ConciergeTimelineDto {
  stages: ConciergeTimelineStageDto[]
  currentStageId: string | null
  progressPercent: number
  durationMs: number
}

export interface ConciergeConfidenceDto {
  score: number
  level: 'high' | 'medium' | 'low'
  label: string
  uncertaintyExplanation: string | null
  factors: string[]
}

export interface ConciergeSummaryDto {
  text: string
  recommendedOptionLabel: string | null
  keyReasons: string[]
  nextStep: string | null
}

export interface ConciergeAlternativeDto {
  kind: string
  label: string
  estimatedCost: number | null
  currency: string
  confidence: number
  explanation: string
  highlights: string[]
  optionId: string | null
}

export interface ConciergeComparisonCardDto {
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

export interface ConciergeSuggestionDto {
  kind: string
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  actionable: boolean
}

/**
 * Recommendation payload UI can consume.
 * When concierge is disabled, additive fields are null/empty and contracts stay compatible.
 */
export interface RecommendationResponseDto {
  conciergeEnabled: boolean
  version: string | null
  explanation: string | null
  timeline: ConciergeTimelineDto | null
  confidence: ConciergeConfidenceDto | null
  summary: ConciergeSummaryDto | null
  alternatives: ConciergeAlternativeDto[]
  comparisonCards: ConciergeComparisonCardDto[]
  suggestions: ConciergeSuggestionDto[]
}

export interface ConversationResponseDto {
  reply: string
  recommendation: RecommendationResponseDto
  conciergeMeta: AgentConciergeExperienceMeta | null
  integrationVersion: string
}

export interface TripResponseDto {
  tripId: string | null
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  currency: string | null
  recommendation: RecommendationResponseDto
  conciergeMeta: AgentConciergeExperienceMeta | null
  integrationVersion: string
}

/** Empty legacy-compatible recommendation (flag off / no data). */
export function emptyRecommendationResponseDto(): RecommendationResponseDto {
  return {
    conciergeEnabled: false,
    version: null,
    explanation: null,
    timeline: null,
    confidence: null,
    summary: null,
    alternatives: [],
    comparisonCards: [],
    suggestions: [],
  }
}
