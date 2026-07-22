/**
 * Sprint 96 — agent bridge for AI Concierge Experience.
 * Presentation layer over existing trip / offer facts — no engine redesign.
 */

import {
  composeConciergeExperience,
  SPRINT96_AI_CONCIERGE_VERSION,
  type ConciergeExperienceResult,
  type ConciergeOfferFacts,
  type ConciergeTripFacts,
} from '../../../core'
import type { AgentMemory } from '../types'
import { isConciergeExperienceEnabled } from './feature'

export { SPRINT96_AI_CONCIERGE_VERSION }

export interface AgentConciergeExperienceRequest {
  conversationId?: string
  iteration?: number
  memory?: AgentMemory | null
  trip?: ConciergeTripFacts
  offers?: ConciergeOfferFacts
  engineConfidence?: number | null
  enabled?: boolean
}

export interface AgentConciergeExperienceMeta {
  version: string
  conversationId: string
  progressPercent: number
  stageCount: number
  alternativeCount: number
  comparisonCount: number
  suggestionCount: number
  confidenceLevel: string
  confidenceScore: number
  recommendedOption: string | null
  durationMs: number
}

export interface AgentConciergeExperienceResponse {
  enabled: boolean
  result: ConciergeExperienceResult | null
  meta: AgentConciergeExperienceMeta | null
  recommendationFacts: string[]
}

export function toAgentConciergeExperienceMeta(
  result: ConciergeExperienceResult,
): AgentConciergeExperienceMeta {
  return {
    version: result.version,
    conversationId: result.conversationId,
    progressPercent: result.timeline.progressPercent,
    stageCount: result.timeline.stages.length,
    alternativeCount: result.alternatives.length,
    comparisonCount: result.comparisonCards.length,
    suggestionCount: result.suggestions.length,
    confidenceLevel: result.confidence.level,
    confidenceScore: result.confidence.score,
    recommendedOption: result.conversationSummary.recommendedOptionLabel,
    durationMs: result.durationMs,
  }
}

function tripFromMemory(memory: AgentMemory | null | undefined): ConciergeTripFacts {
  const r = memory?.requirements
  return {
    destination: r?.destination ?? null,
    origin: r?.origin ?? null,
    startDate: r?.startDate ?? null,
    endDate: r?.endDate ?? null,
    durationDays: r?.durationDays ?? null,
    travelers: r?.travelers ?? null,
    travelerType: r?.travelerType ?? null,
    budgetAmount: r?.budgetAmount ?? null,
    currency: r?.budgetCurrency ?? 'SAR',
    interests: r?.interests ?? [],
    mission: r?.destination ? `Visit ${r.destination}` : null,
  }
}

function recommendationFacts(result: ConciergeExperienceResult): string[] {
  return [
    result.conversationSummary.text,
    result.explanation.whyDestination,
    result.explanation.whyFlights,
    result.explanation.whyHotel,
    result.explanation.whyPackage,
    result.explanation.whyTiming,
    ...result.suggestions.slice(0, 3).map((s) => `${s.title}: ${s.message}`),
  ].filter(Boolean)
}

/**
 * Compose concierge timeline, explanations, alternatives, confidence, cards, suggestions.
 */
export function runConciergeExperience(
  input: AgentConciergeExperienceRequest,
): AgentConciergeExperienceResponse {
  if (!isConciergeExperienceEnabled({ enabled: input.enabled })) {
    return { enabled: false, result: null, meta: null, recommendationFacts: [] }
  }

  const trip: ConciergeTripFacts = {
    ...tripFromMemory(input.memory),
    ...input.trip,
  }

  const result = composeConciergeExperience({
    conversationId: input.conversationId,
    iteration: input.iteration,
    trip,
    offers: input.offers,
    engineConfidence: input.engineConfidence,
  })

  return {
    enabled: true,
    result,
    meta: toAgentConciergeExperienceMeta(result),
    recommendationFacts: recommendationFacts(result),
  }
}

export function enrichWithConciergeExperience(
  input: AgentConciergeExperienceRequest,
): AgentConciergeExperienceResponse {
  return runConciergeExperience(input)
}
