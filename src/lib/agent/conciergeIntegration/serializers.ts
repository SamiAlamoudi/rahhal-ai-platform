/**
 * Sprint 97 — serializers: ConciergeExperienceResult → UI DTOs.
 */

import type { ConciergeExperienceResult } from '../../../core'
import type { AgentConciergeExperienceMeta } from '../conciergeExperience'
import { toAgentConciergeExperienceMeta } from '../conciergeExperience'
import {
  emptyRecommendationResponseDto,
  SPRINT97_CONCIERGE_INTEGRATION_VERSION,
  type ConciergeAlternativeDto,
  type ConciergeComparisonCardDto,
  type ConciergeConfidenceDto,
  type ConciergeSuggestionDto,
  type ConciergeSummaryDto,
  type ConciergeTimelineDto,
  type ConversationResponseDto,
  type RecommendationResponseDto,
  type TripResponseDto,
} from './types'

export function serializeTimeline(
  result: ConciergeExperienceResult,
): ConciergeTimelineDto {
  return {
    stages: result.timeline.stages.map((s) => ({
      id: s.id,
      label: s.label,
      status: s.status,
      message: s.message,
      progressPercent: s.progressPercent,
    })),
    currentStageId: result.timeline.currentStageId,
    progressPercent: result.timeline.progressPercent,
    durationMs: result.timeline.durationMs,
  }
}

export function serializeConfidence(
  result: ConciergeExperienceResult,
): ConciergeConfidenceDto {
  return {
    score: result.confidence.score,
    level: result.confidence.level,
    label: result.confidence.label,
    uncertaintyExplanation: result.confidence.uncertaintyExplanation,
    factors: [...result.confidence.factors],
  }
}

export function serializeSummary(
  result: ConciergeExperienceResult,
): ConciergeSummaryDto {
  return {
    text: result.conversationSummary.text,
    recommendedOptionLabel: result.conversationSummary.recommendedOptionLabel,
    keyReasons: [...result.conversationSummary.keyReasons],
    nextStep: result.conversationSummary.nextStep,
  }
}

export function serializeAlternatives(
  result: ConciergeExperienceResult,
): ConciergeAlternativeDto[] {
  return result.alternatives.map((a) => ({
    kind: a.kind,
    label: a.label,
    estimatedCost: a.estimatedCost,
    currency: a.currency,
    confidence: a.confidence,
    explanation: a.explanation,
    highlights: [...a.highlights],
    optionId: a.optionId,
  }))
}

export function serializeComparisonCards(
  result: ConciergeExperienceResult,
): ConciergeComparisonCardDto[] {
  return result.comparisonCards.map((c) => ({
    optionId: c.optionId,
    title: c.title,
    price: c.price,
    currency: c.currency,
    durationMinutes: c.durationMinutes,
    stops: c.stops,
    hotelQuality: c.hotelQuality,
    overallValue: c.overallValue,
    recommendationReason: c.recommendationReason,
    isRecommended: c.isRecommended,
  }))
}

export function serializeSuggestions(
  result: ConciergeExperienceResult,
): ConciergeSuggestionDto[] {
  return result.suggestions.map((s) => ({
    kind: s.kind,
    title: s.title,
    message: s.message,
    priority: s.priority,
    actionable: s.actionable,
  }))
}

/**
 * RecommendationResponse adapter.
 * Flag off or null result → empty legacy-compatible DTO.
 */
export function toRecommendationResponseDto(
  result: ConciergeExperienceResult | null,
  options?: { enabled?: boolean },
): RecommendationResponseDto {
  const enabled = options?.enabled !== false && result != null
  if (!enabled || !result) {
    return emptyRecommendationResponseDto()
  }
  return {
    conciergeEnabled: true,
    version: result.version,
    explanation: result.explanation.summary,
    timeline: serializeTimeline(result),
    confidence: serializeConfidence(result),
    summary: serializeSummary(result),
    alternatives: serializeAlternatives(result),
    comparisonCards: serializeComparisonCards(result),
    suggestions: serializeSuggestions(result),
  }
}

export function toConversationResponseDto(input: {
  reply: string
  result: ConciergeExperienceResult | null
  meta?: AgentConciergeExperienceMeta | null
  enabled?: boolean
}): ConversationResponseDto {
  const recommendation = toRecommendationResponseDto(input.result, {
    enabled: input.enabled,
  })
  const meta = input.enabled === false || !input.result
    ? null
    : (input.meta ?? toAgentConciergeExperienceMeta(input.result))
  return {
    reply: input.reply,
    recommendation,
    conciergeMeta: meta,
    integrationVersion: SPRINT97_CONCIERGE_INTEGRATION_VERSION,
  }
}

export function toTripResponseDto(input: {
  tripId?: string | null
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  currency?: string | null
  result: ConciergeExperienceResult | null
  meta?: AgentConciergeExperienceMeta | null
  enabled?: boolean
}): TripResponseDto {
  const recommendation = toRecommendationResponseDto(input.result, {
    enabled: input.enabled,
  })
  const meta = input.enabled === false || !input.result
    ? null
    : (input.meta ?? toAgentConciergeExperienceMeta(input.result))
  return {
    tripId: input.tripId ?? null,
    destination: input.destination ?? null,
    origin: input.origin ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    currency: input.currency ?? null,
    recommendation,
    conciergeMeta: meta,
    integrationVersion: SPRINT97_CONCIERGE_INTEGRATION_VERSION,
  }
}
