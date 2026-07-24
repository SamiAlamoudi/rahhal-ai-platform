/**
 * Phase 3 Stage 4 — Confidence engine for intelligence evaluations.
 * Never invents facts; sparse context lowers confidence.
 */

import type {
  AlternativeComparison,
  IntelligenceContext,
  TravelAlternative,
} from './types'
import { clamp01 } from './types'

export interface IntelligenceConfidenceResult {
  overallConfidence: number
  perAlternative: Array<{ alternativeId: string; confidence: number }>
  missingEvidence: string[]
}

export function calculateIntelligenceConfidence(input: {
  context: IntelligenceContext
  alternatives: TravelAlternative[]
  comparisons: AlternativeComparison[]
  decisionScores: Array<{ alternativeId: string; decisionScore: number }>
}): IntelligenceConfidenceResult {
  const missing: string[] = []
  if (!input.context.destination) missing.push('destination')
  if (input.context.budgetAmount == null) missing.push('budget')
  if (input.context.durationDays == null) missing.push('duration')
  if (input.alternatives.length < 2) missing.push('peer_alternatives')

  let base = 0.35
  if (input.context.destination) base += 0.15
  if (input.context.budgetAmount != null) base += 0.08
  if (input.context.durationDays != null) base += 0.08
  if (input.context.interests.length > 0) base += 0.06
  if (input.alternatives.length >= 2) base += 0.12
  if (input.context.conversationNotes.length > 0) base += 0.04
  base -= missing.length * 0.05

  const scores = input.decisionScores.map((s) => s.decisionScore)
  const spread =
    scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0
  // Clear winner → slightly higher confidence; near-ties → lower.
  base += spread > 0.08 ? 0.06 : -0.03

  const overallConfidence = clamp01(base)

  const perAlternative = input.alternatives.map((alt) => {
    const comparison = input.comparisons.find((c) => c.alternativeId === alt.id)
    const decision =
      input.decisionScores.find((d) => d.alternativeId === alt.id)?.decisionScore
      ?? 0
    const evidenceDensity = comparison
      ? comparison.dimensions.reduce((n, d) => n + d.evidence.length, 0)
      : 0
    const confidence = clamp01(
      overallConfidence * 0.7
        + decision * 0.2
        + Math.min(0.1, evidenceDensity * 0.01),
    )
    return { alternativeId: alt.id, confidence }
  })

  return { overallConfidence, perAlternative, missingEvidence: missing }
}

export const ConfidenceEngine = {
  calculate: calculateIntelligenceConfidence,
}
