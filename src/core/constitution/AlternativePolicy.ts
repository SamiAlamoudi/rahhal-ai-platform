/**
 * Sprint 87 — Offer Alternatives (Principle 4).
 */

import {
  ALTERNATIVE_CONFIDENCE_THRESHOLD,
  type BehaviorSnapshot,
  type PrincipleViolation,
} from './BehaviorTypes'

/** Normalize confidence to 0–1 whether callers pass percent or fraction. */
export function normalizeConfidence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value > 1) return Math.min(1, value / 100)
  return Math.max(0, value)
}

export function requiresAlternatives(
  confidence: number | null | undefined,
  threshold = ALTERNATIVE_CONFIDENCE_THRESHOLD,
): boolean {
  const c = normalizeConfidence(confidence)
  if (c == null) return false
  return c < threshold
}

export function evaluateAlternativePolicy(snapshot: BehaviorSnapshot): PrincipleViolation[] {
  const confidence = normalizeConfidence(
    snapshot.confidence ?? snapshot.explanation?.confidence ?? null,
  )
  if (!requiresAlternatives(confidence)) return []
  const count = snapshot.alternativeCount ?? 0
  if (count < 2) {
    return [{
      principleId: 'offer_alternatives',
      code: 'insufficient_alternatives',
      message:
        `Confidence ${confidence} is below threshold ${ALTERNATIVE_CONFIDENCE_THRESHOLD}; at least 2 ranked alternatives are required.`,
      severity: 'mandatory',
    }]
  }
  return []
}
