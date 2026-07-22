/**
 * Sprint 106 — ResponseSummary
 * Executive summary from composed recommendations (facts only).
 */

import type {
  ResponseComposerTripContext,
  ResponseRecommendation,
  ResponseSummarySection,
} from './types'

export function buildResponseSummary(input: {
  trip?: ResponseComposerTripContext | null
  recommendations: ResponseRecommendation[]
  offerCount: number
}): ResponseSummarySection {
  const best =
    input.recommendations.find((r) => r.kind === 'best_overall')
    ?? input.recommendations[0]
    ?? null

  const origin = input.trip?.origin?.trim() || null
  const destination = input.trip?.destination?.trim() || null
  const route =
    origin && destination
      ? `${origin} → ${destination}`
      : destination
        ? `Trip to ${destination}`
        : 'Your trip'

  if (!best || input.offerCount === 0) {
    return {
      headline: `${route}: no offers to recommend`,
      executiveSummary:
        'No provider flight offers were available, so Rahhal could not build a recommendation summary.',
      bestRecommendationLabel: null,
      keyPoints: [],
    }
  }

  const pricePart =
    best.price != null
      ? ` from ${best.currency} ${Math.round(best.price)}`
      : ''
  const durationPart =
    best.durationMinutes != null
      ? ` · ${Math.round(best.durationMinutes / 60 * 10) / 10}h`
      : ''
  const stopsPart =
    best.stops == null
      ? ''
      : best.stops === 0
        ? ' · nonstop'
        : ` · ${best.stops} stop${best.stops === 1 ? '' : 's'}`

  const headline = `${route}: ${best.label}${pricePart}`
  const executiveSummary = [
    `Best pick: ${best.title ?? best.label}${pricePart}${durationPart}${stopsPart}.`,
    best.reason,
  ].join(' ')

  const keyPoints = [
    best.reason,
    ...best.reasons.filter((r) => r !== best.reason).slice(0, 3),
  ]

  const cheapest = input.recommendations.find((r) => r.kind === 'cheapest')
  const fastest = input.recommendations.find((r) => r.kind === 'fastest')
  if (cheapest && cheapest.optionId !== best.optionId && cheapest.price != null) {
    keyPoints.push(
      `Cheapest alternative: ${cheapest.currency} ${Math.round(cheapest.price)}.`,
    )
  }
  if (fastest && fastest.optionId !== best.optionId && fastest.durationMinutes != null) {
    keyPoints.push(
      `Fastest alternative: ${fastest.durationMinutes} minutes total flight time.`,
    )
  }

  return {
    headline,
    executiveSummary,
    bestRecommendationLabel: best.label,
    keyPoints: [...new Set(keyPoints)].slice(0, 6),
  }
}

export class ResponseSummary {
  build(input: {
    trip?: ResponseComposerTripContext | null
    recommendations: ResponseRecommendation[]
    offerCount: number
  }): ResponseSummarySection {
    return buildResponseSummary(input)
  }
}

export function createResponseSummary(): ResponseSummary {
  return new ResponseSummary()
}
