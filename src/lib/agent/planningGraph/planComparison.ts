/**
 * Evolution Sprint 4 — PlanComparison
 * Compare two plan nodes by score, confidence, fit signals.
 */

import type { PlanComparisonResult, PlanNodeData } from './planningGraphTypes'

export function comparePlans(left: PlanNodeData, right: PlanNodeData): PlanComparisonResult {
  const scoreDelta = left.score - right.score
  const confidenceDelta = left.confidence - right.confidence
  const reasons: string[] = []
  const tradeoffs: string[] = []
  const risks: string[] = []

  if (Math.abs(scoreDelta) < 1 && Math.abs(confidenceDelta) < 0.05) {
    reasons.push('Plans are nearly tied on score and confidence.')
  } else if (scoreDelta > 0) {
    reasons.push(`Left scores higher (${left.score} vs ${right.score}).`)
  } else {
    reasons.push(`Right scores higher (${right.score} vs ${left.score}).`)
  }

  if (left.destinations.join() !== right.destinations.join()) {
    reasons.push(
      `Destination sets differ: [${left.destinations.join(', ') || 'open'}] vs [${right.destinations.join(', ') || 'open'}].`,
    )
  }
  if ((left.budget.amount ?? 0) !== (right.budget.amount ?? 0)) {
    reasons.push('Budget targets differ.')
  }
  if (left.missingData.length !== right.missingData.length) {
    reasons.push(
      `Missing-data load: left=${left.missingData.length}, right=${right.missingData.length}.`,
    )
  }

  tradeoffs.push(...left.tradeoffs.slice(0, 2), ...right.tradeoffs.slice(0, 2))
  risks.push(...left.risks.slice(0, 2), ...right.risks.slice(0, 2))

  let winnerId: string | null = left.id
  const compositeLeft = left.score + left.confidence * 20 - left.missingData.length * 2
  const compositeRight = right.score + right.confidence * 20 - right.missingData.length * 2
  if (Math.abs(compositeLeft - compositeRight) < 0.5) winnerId = null
  else winnerId = compositeLeft >= compositeRight ? left.id : right.id

  return {
    leftId: left.id,
    rightId: right.id,
    winnerId,
    scoreDelta,
    confidenceDelta,
    reasons,
    tradeoffs: [...new Set(tradeoffs)],
    risks: [...new Set(risks)],
  }
}

export const PlanComparison = {
  compare: comparePlans,
}
