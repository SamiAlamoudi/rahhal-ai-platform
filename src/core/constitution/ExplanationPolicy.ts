/**
 * Sprint 87 — Explain Every Recommendation (Principle 3).
 */

import type { BehaviorSnapshot, PrincipleViolation } from './BehaviorTypes'

export interface ExplanationRequirement {
  why: boolean
  benefits: boolean
  tradeoffs: boolean
  confidence: boolean
}

export function explanationCompleteness(
  explanation: BehaviorSnapshot['explanation'],
): ExplanationRequirement {
  return {
    why: Boolean(explanation?.why?.trim()),
    benefits: (explanation?.benefits?.length ?? 0) > 0,
    tradeoffs: (explanation?.tradeoffs?.length ?? 0) > 0,
    confidence: explanation?.confidence != null && Number.isFinite(explanation.confidence),
  }
}

export function isExplanationComplete(
  explanation: BehaviorSnapshot['explanation'],
): boolean {
  const c = explanationCompleteness(explanation)
  return c.why && c.benefits && c.tradeoffs && c.confidence
}

export function evaluateExplanationPolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  if (!snapshot.hasRecommendation) return []
  const violations: PrincipleViolation[] = []
  const complete = explanationCompleteness(snapshot.explanation ?? null)
  if (!complete.why) {
    violations.push({
      principleId: 'explain_every_recommendation',
      code: 'missing_why',
      message: 'Recommendation missing why explanation.',
      severity: 'mandatory',
    })
  }
  if (!complete.benefits) {
    violations.push({
      principleId: 'explain_every_recommendation',
      code: 'missing_benefits',
      message: 'Recommendation missing benefits.',
      severity: 'mandatory',
    })
  }
  if (!complete.tradeoffs) {
    violations.push({
      principleId: 'explain_every_recommendation',
      code: 'missing_tradeoffs',
      message: 'Recommendation missing tradeoffs.',
      severity: 'mandatory',
    })
  }
  if (!complete.confidence) {
    violations.push({
      principleId: 'explain_every_recommendation',
      code: 'missing_confidence',
      message: 'Recommendation missing confidence.',
      severity: 'mandatory',
    })
  }
  return violations
}
