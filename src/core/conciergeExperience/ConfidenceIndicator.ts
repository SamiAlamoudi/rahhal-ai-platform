/**
 * Sprint 96 — Confidence Indicator (High / Medium / Low + uncertainty text).
 */

import type { ConciergeConfidenceIndicator, ConciergeConfidenceLevel } from './types'

function levelFromScore(score: number): ConciergeConfidenceLevel {
  if (score >= 0.75) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

function labelFor(level: ConciergeConfidenceLevel): string {
  if (level === 'high') return 'High confidence'
  if (level === 'medium') return 'Medium confidence'
  return 'Low confidence'
}

export function buildConfidenceIndicator(input: {
  engineConfidence?: number | null
  hasDestination?: boolean
  hasFlights?: boolean
  hasHotels?: boolean
  hasPackage?: boolean
  hasDecision?: boolean
  alternativeCount?: number
}): ConciergeConfidenceIndicator {
  const factors: string[] = []
  let score = typeof input.engineConfidence === 'number' && Number.isFinite(input.engineConfidence)
    ? (input.engineConfidence > 1 ? input.engineConfidence / 100 : input.engineConfidence)
    : 0.55

  if (input.hasDestination) {
    score += 0.08
    factors.push('Destination is clear')
  } else {
    score -= 0.12
    factors.push('Destination still flexible')
  }
  if (input.hasFlights) {
    score += 0.08
    factors.push('Flight options available')
  } else {
    score -= 0.1
    factors.push('Limited flight evidence')
  }
  if (input.hasHotels) {
    score += 0.06
    factors.push('Hotel options available')
  } else {
    score -= 0.08
    factors.push('Hotel evidence incomplete')
  }
  if (input.hasPackage) {
    score += 0.06
    factors.push('Package coherence checked')
  }
  if (input.hasDecision) {
    score += 0.05
    factors.push('Decision ranking available')
  }
  if ((input.alternativeCount ?? 0) >= 3) {
    score += 0.04
    factors.push('Multiple alternatives compared')
  }

  score = Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  const level = levelFromScore(score)

  let uncertaintyExplanation: string | null = null
  if (level === 'medium') {
    uncertaintyExplanation = 'Confidence is medium because some offer details or preference signals are still incomplete — alternatives stay visible so you can adjust.'
  } else if (level === 'low') {
    uncertaintyExplanation = 'Confidence is low due to missing destination, sparse offers, or weak ranking signals. Share budget, dates, or preferences and I will re-score.'
  }

  return {
    score,
    level,
    label: labelFor(level),
    uncertaintyExplanation,
    factors,
  }
}
