/**
 * Phase 3 Stage 3 — Confidence scoring for proactive recommendations.
 * Never invents facts; missing evidence lowers confidence and may require clarification.
 */

import type { ProactiveContextBag, ProactiveDetectedSignal } from './types'
import { clamp01 } from './types'

export interface ProactiveConfidenceResult {
  confidence: number
  clarificationRequired: boolean
  missingEvidence: string[]
  supportingCount: number
}

export function scoreProactiveConfidence(input: {
  detected: ProactiveDetectedSignal
  context: ProactiveContextBag
}): ProactiveConfidenceResult {
  const { detected, context } = input
  let confidence = detected.baseConfidence
  const missing = [...detected.missingEvidence]

  // Boost when stronger context exists — still no invented details.
  if (context.destination) confidence += 0.08
  if (context.budgetAmount != null) confidence += 0.04
  if (context.durationDays != null || context.monthHint != null) confidence += 0.04
  if (context.hasFamilySignal && detected.signal === 'family_travel') confidence += 0.06
  if (context.hasBusinessSignal && detected.signal === 'executive_travel') confidence += 0.06
  if (context.unifiedSummary.length > 0) confidence += 0.03

  // Penalize sparse evidence
  const support = detected.supportingEvidence.length
  if (support === 0) confidence -= 0.2
  else if (support === 1) confidence -= 0.05

  confidence -= Math.min(0.24, missing.length * 0.06)
  confidence = clamp01(confidence)

  const clarificationRequired = confidence < 0.45 && missing.length > 0

  return {
    confidence,
    clarificationRequired,
    missingEvidence: missing,
    supportingCount: support,
  }
}

export const ProactiveConfidence = {
  score: scoreProactiveConfidence,
}
