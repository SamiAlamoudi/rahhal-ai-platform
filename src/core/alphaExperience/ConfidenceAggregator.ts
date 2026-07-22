/**
 * Sprint 91 — aggregate confidence from existing engines (no new scoring engine).
 */

import type { AlphaConfidenceBreakdown } from './types'

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n))
}

export function aggregateConfidence(input: {
  flightConfidence?: number | null
  hotelConfidence?: number | null
  packageConfidence?: number | null
  decisionConfidence?: number | null
  refinementConfidence?: number | null
  constitutionOk?: boolean
}): AlphaConfidenceBreakdown {
  const flight = clamp01(input.flightConfidence ?? 0.7)
  const hotel = clamp01(input.hotelConfidence ?? 0.7)
  const pkg = clamp01(input.packageConfidence ?? 0.7)
  const decision = clamp01(
    input.decisionConfidence != null && input.decisionConfidence > 1
      ? input.decisionConfidence / 100
      : (input.decisionConfidence ?? 0.7),
  )
  const refinement = clamp01(input.refinementConfidence ?? decision)

  let overall = (flight * 0.2) + (hotel * 0.2) + (pkg * 0.25) + (decision * 0.25) + (refinement * 0.1)
  if (input.constitutionOk === false) {
    overall = Math.min(overall, 0.55)
  }
  overall = Math.round(overall * 1000) / 1000

  const parts: string[] = []
  if (pkg >= 0.75) parts.push('Strong package fit')
  else if (pkg >= 0.5) parts.push('Acceptable package fit')
  else parts.push('Package confidence is limited')

  if (decision >= 0.75) parts.push('Decision engine is confident')
  else parts.push('Decision confidence is moderate')

  if (flight >= hotel) parts.push('Flight options look solid')
  else parts.push('Hotel options look solid')

  if (input.constitutionOk === false) {
    parts.push('Governance checks suggested extra caution')
  }

  return {
    overall,
    flight,
    hotel,
    package: pkg,
    decision,
    refinement,
    reasoningSummary: parts.join('. ') + '.',
  }
}
