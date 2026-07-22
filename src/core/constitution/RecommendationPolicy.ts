/**
 * Sprint 87 — recommendation governance (Principles 2, 3, 4, 7).
 */

import { evaluateAlternativePolicy } from './AlternativePolicy'
import { evaluateExplanationPolicy } from './ExplanationPolicy'
import { evaluateMissionPolicy } from './MissionPolicy'
import type { BehaviorSnapshot, PrincipleViolation } from './BehaviorTypes'

export function evaluateRecommendationPolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  return [
    ...evaluateMissionPolicy(snapshot),
    ...evaluateExplanationPolicy(snapshot),
    ...evaluateAlternativePolicy(snapshot),
  ]
}

/** Helper for engines composing a constitution-compliant recommendation payload. */
export function buildCompliantRecommendationSkeleton(input: {
  why: string
  benefits: string[]
  tradeoffs: string[]
  confidence: number
  alternatives?: unknown[]
}): BehaviorSnapshot {
  return {
    hasRecommendation: true,
    confidence: input.confidence,
    alternativeCount: input.alternatives?.length ?? 0,
    explanation: {
      why: input.why,
      benefits: input.benefits,
      tradeoffs: input.tradeoffs,
      confidence: input.confidence,
    },
  }
}

export type { PrincipleViolation }
