/**
 * Sprint 106 — ConfidenceExplainer
 * Score confidence from available provider facts only.
 */

import type {
  ResponseComposerFlightFacts,
  ResponseConfidenceBreakdown,
} from './types'

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function levelOf(score: number): ResponseConfidenceBreakdown['level'] {
  if (score >= 0.75) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}

function labelOf(level: ResponseConfidenceBreakdown['level']): string {
  if (level === 'high') return 'High confidence'
  if (level === 'medium') return 'Medium confidence'
  return 'Low confidence'
}

export function explainConfidence(input: {
  flights: ResponseComposerFlightFacts[]
  decisionConfidence?: number | null
}): ResponseConfidenceBreakdown {
  const flights = input.flights
  const explanations: string[] = []

  if (flights.length === 0) {
    return {
      overall: 0,
      level: 'low',
      label: labelOf('low'),
      priceConfidence: 0,
      scheduleConfidence: 0,
      recommendationConfidence: 0,
      explanations: ['No provider offers available to score confidence.'],
    }
  }

  const withPrice = flights.filter((f) => f.price != null).length
  const priceConfidence = clamp01(withPrice / flights.length)
  if (withPrice === flights.length) {
    explanations.push('Price confidence: all offers include a provider price.')
  } else if (withPrice > 0) {
    explanations.push(
      `Price confidence: ${withPrice} of ${flights.length} offers include a provider price.`,
    )
  } else {
    explanations.push('Price confidence: no provider prices present.')
  }

  const withSchedule = flights.filter(
    (f) =>
      f.durationMinutes != null
      || f.departureAt != null
      || f.arrivalAt != null
      || f.departureHour != null
      || f.arrivalHour != null,
  ).length
  const scheduleConfidence = clamp01(withSchedule / flights.length)
  if (withSchedule === flights.length) {
    explanations.push('Schedule confidence: all offers include schedule facts.')
  } else if (withSchedule > 0) {
    explanations.push(
      `Schedule confidence: ${withSchedule} of ${flights.length} offers include schedule facts.`,
    )
  } else {
    explanations.push('Schedule confidence: no schedule facts present.')
  }

  const withStops = flights.filter((f) => f.stops != null).length
  const withAirline = flights.filter((f) => Boolean(f.airline)).length
  const completeness = clamp01(
    (withStops + withAirline + withPrice + withSchedule) / (flights.length * 4),
  )

  const decision =
    input.decisionConfidence != null && Number.isFinite(input.decisionConfidence)
      ? clamp01(input.decisionConfidence)
      : null

  const recommendationConfidence = decision != null
    ? clamp01(0.5 * decision + 0.5 * completeness)
    : completeness

  if (decision != null) {
    explanations.push(
      `Recommendation confidence: Decision Engine score ${Math.round(decision * 100)}% blended with offer completeness.`,
    )
  } else {
    explanations.push(
      'Recommendation confidence: based on offer field completeness from provider data.',
    )
  }

  const overall = clamp01(
    0.35 * priceConfidence + 0.3 * scheduleConfidence + 0.35 * recommendationConfidence,
  )
  const level = levelOf(overall)

  return {
    overall: Math.round(overall * 1000) / 1000,
    level,
    label: labelOf(level),
    priceConfidence: Math.round(priceConfidence * 1000) / 1000,
    scheduleConfidence: Math.round(scheduleConfidence * 1000) / 1000,
    recommendationConfidence: Math.round(recommendationConfidence * 1000) / 1000,
    explanations,
  }
}

export class ConfidenceExplainer {
  explain(input: {
    flights: ResponseComposerFlightFacts[]
    decisionConfidence?: number | null
  }): ResponseConfidenceBreakdown {
    return explainConfidence(input)
  }
}

export function createConfidenceExplainer(): ConfidenceExplainer {
  return new ConfidenceExplainer()
}
