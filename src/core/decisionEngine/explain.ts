/**
 * Sprint 79 — explainable decision copy.
 */

import type { DecisionReason, SearchCandidate } from '../types'

export function buildDecisionReasons(
  selected: SearchCandidate,
  alternatives: SearchCandidate[],
): DecisionReason[] {
  const reasons: DecisionReason[] = []
  const runnerUp = alternatives.find((c) => c.id !== selected.id) ?? null
  const score = selected.score

  if (runnerUp) {
    const savings = runnerUp.totalPrice - selected.totalPrice
    if (savings > 0) {
      reasons.push({
        code: 'saves_money',
        message: `saves ${selected.currency} ${Math.round(savings)}`,
        impact: 'positive',
        delta: savings,
      })
    } else if (savings < 0 && score && (score.dimensions.hotel_rating >= 80 || score.dimensions.overall_convenience >= 80)) {
      reasons.push({
        code: 'worth_premium',
        message: `costs ${selected.currency} ${Math.round(-savings)} more for better quality`,
        impact: 'neutral',
        delta: savings,
      })
    }

    const selDur = selected.flight.durationMinutes
    const altDur = runnerUp.flight.durationMinutes
    if (selDur != null && altDur != null) {
      const diff = selDur - altDur
      if (diff > 0 && diff <= 60) {
        reasons.push({
          code: 'slightly_longer',
          message: `only ${diff} minutes longer`,
          impact: 'neutral',
          delta: diff,
        })
      } else if (diff < 0) {
        reasons.push({
          code: 'faster',
          message: `${Math.abs(diff)} minutes faster`,
          impact: 'positive',
          delta: diff,
        })
      }
    }
  }

  if ((selected.score?.dimensions.hotel_rating ?? 0) >= 80) {
    reasons.push({
      code: 'better_hotel',
      message: 'better hotel',
      impact: 'positive',
    })
  }
  if (selected.flight.stops === 0) {
    reasons.push({
      code: 'fewer_transfers',
      message: 'fewer transfers',
      impact: 'positive',
    })
  } else if (selected.flight.stops <= 1 && (selected.score?.dimensions.layovers ?? 0) >= 70) {
    reasons.push({
      code: 'manageable_layover',
      message: 'manageable layover',
      impact: 'positive',
    })
  }
  if ((selected.hotel.walkMinutes ?? 99) <= 15) {
    reasons.push({
      code: 'short_walk',
      message: 'short walking distance',
      impact: 'positive',
    })
  }

  if (reasons.length === 0) {
    reasons.push({
      code: 'best_score',
      message: `highest journey score (${selected.score?.overall ?? 0}/100)`,
      impact: 'positive',
    })
  }

  return reasons.slice(0, 5)
}

export function formatExplanation(
  selected: SearchCandidate,
  reasons: DecisionReason[],
  confidence: number,
): string {
  const optionLabel = selected.labels.includes('best_overall')
    ? 'Best Overall'
    : selected.title
  const bullets = reasons.map((r) => `- ${r.message}`).join('\n')
  return `I selected ${optionLabel} because:\n\n${bullets}\n\nConfidence: ${Math.round(confidence)}%`
}
