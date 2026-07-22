/**
 * Sprint 96 — ConciergeComposer: assemble full AI Concierge Experience result.
 */

import { buildConciergeAlternatives } from './AlternativeScenarios'
import { buildComparisonCards } from './ComparisonCards'
import { buildConfidenceIndicator } from './ConfidenceIndicator'
import { buildConversationSummary } from './ConversationSummary'
import { buildConciergeExplanation } from './ExplanationEngine'
import { runRecommendationTimeline } from './RecommendationTimeline'
import { buildConciergeSuggestions } from './ConciergeSuggestions'
import {
  SPRINT96_AI_CONCIERGE_VERSION,
  type ConciergeComposeRequest,
  type ConciergeExperienceResult,
} from './types'

function newConversationId(now: number): string {
  return `cx_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export class ConciergeComposer {
  compose(input: ConciergeComposeRequest): ConciergeExperienceResult {
    const started = Date.now()
    const trip = input.trip
    const offers = input.offers ?? {}
    const offerCount = (offers.flights?.length ?? 0)
      + (offers.hotels?.length ?? 0)
      + (offers.packages?.length ?? 0)

    const timeline = runRecommendationTimeline({
      destination: trip.destination,
      offerCount,
    })

    const explanation = buildConciergeExplanation({ trip, offers })
    const alternatives = buildConciergeAlternatives({ trip, offers })
    const confidence = buildConfidenceIndicator({
      engineConfidence: input.engineConfidence
        ?? offers.decision?.confidence
        ?? offers.priceConfidence
        ?? null,
      hasDestination: Boolean(trip.destination?.trim()),
      hasFlights: (offers.flights?.length ?? 0) > 0,
      hasHotels: (offers.hotels?.length ?? 0) > 0,
      hasPackage: (offers.packages?.length ?? 0) > 0,
      hasDecision: Boolean(offers.decision),
      alternativeCount: alternatives.length,
    })

    const comparisonCards = buildComparisonCards({ trip, offers, alternatives })
    const recommended = alternatives.find((a) => a.kind === 'best_value')
      ?? alternatives[0]
      ?? null

    const conversationSummary = buildConversationSummary({
      trip,
      explanation,
      confidence,
      recommended,
      iteration: input.iteration,
    })

    const suggestions = buildConciergeSuggestions({ trip })

    return {
      version: SPRINT96_AI_CONCIERGE_VERSION,
      conversationId: input.conversationId?.trim() || newConversationId(started),
      timeline,
      explanation,
      alternatives,
      confidence,
      comparisonCards,
      suggestions,
      conversationSummary,
      durationMs: Date.now() - started,
    }
  }
}

export function createConciergeComposer(): ConciergeComposer {
  return new ConciergeComposer()
}

export function composeConciergeExperience(
  input: ConciergeComposeRequest,
): ConciergeExperienceResult {
  return createConciergeComposer().compose(input)
}
