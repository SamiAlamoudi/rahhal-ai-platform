/**
 * Sprint 96 — Conversation Summary after each planning iteration.
 */

import type {
  ConciergeAlternativeScenario,
  ConciergeConfidenceIndicator,
  ConciergeConversationSummary,
  ConciergeExplanation,
  ConciergeTripFacts,
} from './types'

export function buildConversationSummary(input: {
  trip: ConciergeTripFacts
  explanation: ConciergeExplanation
  confidence: ConciergeConfidenceIndicator
  recommended?: ConciergeAlternativeScenario | null
  iteration?: number
}): ConciergeConversationSummary {
  const destination = input.trip.destination?.trim() || 'your trip'
  const option = input.recommended
  const label = option?.label ?? 'Option A'
  const currency = option?.currency || input.trip.currency || 'SAR'
  const budgetBit = input.trip.budgetAmount != null
    ? `your budget (${Math.round(input.trip.budgetAmount)} ${currency})`
    : 'your budget'
  const styleBit = input.trip.travelerType
    ? ` and ${input.trip.travelerType} travel style`
    : ' and travel style'

  const keyReasons = [
    input.explanation.whyDestination,
    input.explanation.whyFlights,
    input.explanation.whyHotel,
  ].map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 3)

  const text = [
    `Based on ${budgetBit}${styleBit}, I recommend ${label}`,
    `for ${destination}`,
    option?.estimatedCost != null ? `around ${Math.round(option.estimatedCost)} ${currency}` : null,
    `because ${option?.explanation || input.explanation.summary}`,
    input.confidence.level !== 'high' && input.confidence.uncertaintyExplanation
      ? ` (${input.confidence.label}: ${input.confidence.uncertaintyExplanation})`
      : ` (${input.confidence.label}).`,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

  const nextStep = input.confidence.level === 'low'
    ? 'Share clearer dates, budget, or preferences and I will refine the shortlist.'
    : 'You can compare alternatives, adjust constraints, or proceed to booking when ready.'

  return {
    text,
    recommendedOptionLabel: label,
    keyReasons,
    nextStep,
  }
}
