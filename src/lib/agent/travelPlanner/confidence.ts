/**
 * Sprint 78 — planner confidence score.
 */

import type { DetectedConstraint, TravelPurpose } from './types'

export function computePlannerConfidence(input: {
  purpose: TravelPurpose
  constraints: DetectedConstraint[]
  missingInformation: string[]
  cueCount: number
}): number {
  let score = 42
  if (input.purpose !== 'unknown') score += 18
  score += Math.min(24, input.constraints.length * 4)
  score += Math.min(12, input.cueCount * 3)
  score -= input.missingInformation.length * 10
  if (input.missingInformation.includes('destination')) score -= 8
  if (input.missingInformation.includes('dates')) score -= 6
  return Math.max(5, Math.min(100, Math.round(score)))
}
