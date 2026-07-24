/**
 * Evolution Sprint 4 — DiscardCandidates
 * Suggest which plans are weak enough to reject/archive (keeps them recoverable).
 */

import type { DiscardCandidate, PlanNodeData } from './planningGraphTypes'

export function findDiscardCandidates(nodes: PlanNodeData[]): DiscardCandidate[] {
  return nodes
    .filter((n) => n.status === 'active' || n.status === 'branched' || n.status === 'restored')
    .map((n) => {
      const reasons: string[] = []
      let penalty = 0
      if (n.score < 40) {
        penalty += 20
        reasons.push('Low composite score.')
      }
      if (n.confidence < 0.35) {
        penalty += 15
        reasons.push('Low confidence.')
      }
      if (n.missingData.length >= 5) {
        penalty += 15
        reasons.push('Heavy missing-data load.')
      }
      if (n.risks.length >= 4) {
        penalty += 10
        reasons.push('Elevated risk notes.')
      }
      if (!n.destinations.length && n.intent !== 'discover') {
        penalty += 8
        reasons.push('No destination direction outside discovery.')
      }
      return {
        nodeId: n.id,
        reason: reasons.join(' ') || 'Marginal plan.',
        score: n.score - penalty,
        confidence: n.confidence,
        _penalty: penalty,
      }
    })
    .filter((c) => c._penalty >= 20)
    .map(({ nodeId, reason, score, confidence }) => ({ nodeId, reason, score, confidence }))
    .sort((a, b) => a.score - b.score)
}

export const DiscardCandidates = {
  find: findDiscardCandidates,
}
