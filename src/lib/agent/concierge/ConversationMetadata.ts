/**
 * Sprint 111 — ConversationMetadata
 * Structured metadata for the decision conversation layer.
 */

import type {
  ConciergeConversationMetadata,
  ConciergeExplanation,
  ConciergeRecommendationOption,
  ConciergeSavingsAnalysis,
  ConciergeTradeoff,
} from './types'

export function buildConversationMetadata(input: {
  selected: ConciergeRecommendationOption | null
  explanation: ConciergeExplanation | null
  tradeoffs: ConciergeTradeoff[]
  savings: ConciergeSavingsAnalysis | null
  decisionConfidence?: number | null
  recommendations: ConciergeRecommendationOption[]
}): ConciergeConversationMetadata {
  const selected = input.selected
  const confidence = clamp01(
    selected?.confidence
      ?? input.decisionConfidence
      ?? (selected ? 0.55 : 0),
  )

  const warnings: string[] = []
  if (!selected) {
    warnings.push('No recommendation selected')
  }
  if (input.recommendations.length === 0) {
    warnings.push('Empty recommendation set')
  }
  if (input.explanation?.weaknesses.length) {
    warnings.push(...input.explanation.weaknesses.slice(0, 3))
  }
  if (
    input.savings?.potentialSavingsVsSelected
    && input.savings.potentialSavingsVsSelected > 0
  ) {
    warnings.push(
      `Cheaper alternative available (save up to ${input.savings.potentialSavingsVsSelected} ${input.savings.currency})`,
    )
  }
  if (
    selected?.stops != null
    && selected.stops >= 2
  ) {
    warnings.push(`Selected itinerary has ${selected.stops} stops`)
  }

  const highlights: string[] = []
  if (input.explanation?.strengths.length) {
    highlights.push(...input.explanation.strengths.slice(0, 4))
  }
  if (selected?.stops === 0) {
    highlights.push('Nonstop flight')
  }
  if (selected?.hotelStars != null && selected.hotelStars >= 4) {
    highlights.push(`${selected.hotelStars}★ hotel`)
  }
  if (
    input.savings?.potentialSavingsVsBudget
    && input.savings.potentialSavingsVsBudget > 0
  ) {
    highlights.push(
      `${input.savings.potentialSavingsVsBudget} ${input.savings.currency} under budget`,
    )
  }

  const costSummary = input.savings?.summary
    ?? (selected?.price != null
      ? `Selected cost ${selected.price} ${selected.currency}`
      : 'Cost details unavailable from current facts')

  const qualityBits: string[] = []
  if (selected?.durationMinutes != null) {
    qualityBits.push(`${selected.durationMinutes} min travel`)
  }
  if (selected?.stops != null) {
    qualityBits.push(
      selected.stops === 0 ? 'nonstop' : `${selected.stops} stop(s)`,
    )
  }
  if (selected?.hotelStars != null) {
    qualityBits.push(`${selected.hotelStars}★ hotel`)
  }
  if (selected?.cabin) {
    qualityBits.push(selected.cabin)
  }
  const qualitySummary =
    qualityBits.length > 0
      ? qualityBits.join(' · ')
      : 'Quality details unavailable from current facts'

  return {
    confidence,
    reasoningSummary:
      input.explanation?.reasoningSummary
      ?? 'Insufficient facts for a reasoning summary',
    tradeoffs: input.tradeoffs.slice(),
    warnings,
    highlights,
    bestFor: input.explanation?.bestFor ?? 'General travelers',
    costSummary,
    qualitySummary,
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000))
}

/**
 * Map Response Composer recommendations into Concierge options (RC unchanged).
 */
export function optionsFromResponseComposer(
  result: {
    recommendations: Array<{
      kind: string
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
    }>
    confidence?: { overall: number } | null
  } | null | undefined,
): ConciergeRecommendationOption[] {
  if (!result?.recommendations?.length) return []
  return result.recommendations
    .filter((r) => r.optionId)
    .map((r) => ({
      id: r.optionId as string,
      title: r.title ?? r.label,
      price: r.price,
      currency: r.currency || 'SAR',
      durationMinutes: r.durationMinutes,
      stops: r.stops,
      cabin: r.cabin,
      airline: r.airline,
      hotelName: null,
      hotelStars: null,
      confidence: result.confidence?.overall ?? null,
      score: null,
      kind: r.kind,
      reason: r.reason,
      labels: [r.kind, r.label].filter(Boolean),
    }))
}

export class ConversationMetadata {
  build(input: Parameters<typeof buildConversationMetadata>[0]) {
    return buildConversationMetadata(input)
  }
}

export function createConversationMetadata(): ConversationMetadata {
  return new ConversationMetadata()
}
