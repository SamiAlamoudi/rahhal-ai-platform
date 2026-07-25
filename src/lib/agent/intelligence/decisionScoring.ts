/**
 * Phase 3 Stage 4 — Decision scoring for travel alternatives.
 * Weighted blend of comparative dimensions + traveler context.
 */

import type {
  AlternativeComparison,
  IntelligenceContext,
  IntelligenceDimension,
  TravelAlternative,
} from './types'
import { clamp01 } from './types'

const BASE_WEIGHTS: Record<IntelligenceDimension, number> = {
  price: 0.12,
  duration: 0.08,
  convenience: 0.1,
  visa_difficulty: 0.1,
  weather_suitability: 0.08,
  family_friendliness: 0.08,
  business_suitability: 0.08,
  accessibility: 0.08,
  preference_fit: 0.14,
  conversation_fit: 0.14,
}

export function resolveDecisionWeights(
  context: IntelligenceContext,
): Record<IntelligenceDimension, number> {
  const weights = { ...BASE_WEIGHTS }
  if (context.hasFamilySignal) {
    weights.family_friendliness += 0.06
    weights.convenience += 0.02
  }
  if (context.hasBusinessSignal) {
    weights.business_suitability += 0.06
    weights.convenience += 0.02
  }
  if (context.hasAccessibilitySignal) {
    weights.accessibility += 0.08
  }
  if (context.budgetAmount != null) {
    weights.price += 0.04
  }
  // Normalize
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  for (const key of Object.keys(weights) as IntelligenceDimension[]) {
    weights[key] = weights[key] / total
  }
  return weights
}

export function scoreTravelDecision(input: {
  alternative: TravelAlternative
  comparison: AlternativeComparison
  context: IntelligenceContext
}): number {
  const weights = resolveDecisionWeights(input.context)
  let score = 0
  for (const dim of input.comparison.dimensions) {
    score += dim.score * (weights[dim.dimension] ?? 0)
  }
  return clamp01(score)
}

export function scoreAllDecisions(input: {
  alternatives: TravelAlternative[]
  comparisons: AlternativeComparison[]
  context: IntelligenceContext
}): Array<{ alternativeId: string; decisionScore: number }> {
  const byId = new Map(input.comparisons.map((c) => [c.alternativeId, c]))
  return input.alternatives.map((alt) => {
    const comparison = byId.get(alt.id)
    const decisionScore = comparison
      ? scoreTravelDecision({
          alternative: alt,
          comparison,
          context: input.context,
        })
      : 0
    return { alternativeId: alt.id, decisionScore }
  })
}

export const DecisionScoring = {
  weights: resolveDecisionWeights,
  score: scoreTravelDecision,
  scoreAll: scoreAllDecisions,
}
