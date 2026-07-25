/**
 * Evolution Sprint 4 — BestPlanSelector
 * Pick the best active plan by score + confidence − gaps.
 */

import { scorePlanNode } from './planNode'
import type { BestPlanSelection, PlanNodeData } from './planningGraphTypes'

export function selectBestPlan(nodes: PlanNodeData[]): BestPlanSelection {
  const active = nodes
    .filter((n) => n.status === 'active' || n.status === 'restored' || n.status === 'branched')
    .map((n) => ({ node: n, score: scorePlanNode(n) }))
    .sort((a, b) => b.score - a.score || b.node.confidence - a.node.confidence)

  if (active.length === 0) {
    return { nodeId: null, score: 0, confidence: 0, reasons: ['No active plans.'], runnersUp: [] }
  }

  const best = active[0]!
  const reasons = [
    `Selected "${best.node.label}" with score ${best.score}.`,
    `Confidence ${(best.node.confidence * 100).toFixed(0)}%.`,
  ]
  if (best.node.destinations.length) {
    reasons.push(`Destinations: ${best.node.destinations.join(', ')}.`)
  }
  if (best.node.whyExists) reasons.push(`Branch rationale: ${best.node.whyExists}`)

  return {
    nodeId: best.node.id,
    score: best.score,
    confidence: best.node.confidence,
    reasons,
    runnersUp: active.slice(1, 4).map((r) => ({ nodeId: r.node.id, score: r.score })),
  }
}

export const BestPlanSelector = {
  select: selectBestPlan,
}
