/**
 * Evolution Sprint 6 — RecommendationComparator
 */

import type { RecommendationCandidate, RecommendationPackage } from './recommendationTypes'
import { scoreCandidate } from './recommendationScorer'

export function compareCandidates(
  left: RecommendationCandidate,
  right: RecommendationCandidate,
  peers: RecommendationCandidate[],
): {
  leftId: string
  rightId: string
  winnerId: string | null
  reasons: string[]
} {
  const ls = scoreCandidate(left, peers)
  const rs = scoreCandidate(right, peers)
  const reasons: string[] = [
    `Composite ${ls.compositeScore} vs ${rs.compositeScore}.`,
    `Value ${ls.valueScore} vs ${rs.valueScore}.`,
    `Risk ${ls.riskScore} vs ${rs.riskScore}.`,
  ]
  if (Math.abs(ls.compositeScore - rs.compositeScore) < 4) {
    return { leftId: left.id, rightId: right.id, winnerId: null, reasons: [...reasons, 'Near tie.'] }
  }
  const winnerId = ls.compositeScore >= rs.compositeScore ? left.id : right.id
  reasons.push(`Winner: ${winnerId === left.id ? left.label : right.label}`)
  return { leftId: left.id, rightId: right.id, winnerId, reasons }
}

export function comparePackages(
  a: RecommendationPackage,
  b: RecommendationPackage,
): { preferredId: string | null; reasons: string[] } {
  const reasons = [
    `Confidence ${a.confidence.toFixed(2)} vs ${b.confidence.toFixed(2)}.`,
    `Composite ${a.scores.compositeScore} vs ${b.scores.compositeScore}.`,
  ]
  if (Math.abs(a.scores.compositeScore - b.scores.compositeScore) < 3
    && Math.abs(a.confidence - b.confidence) < 0.05) {
    return { preferredId: null, reasons: [...reasons, 'Packages nearly tied.'] }
  }
  const preferredId =
    a.scores.compositeScore + a.confidence * 20
      >= b.scores.compositeScore + b.confidence * 20
      ? a.id
      : b.id
  return { preferredId, reasons }
}

export const RecommendationComparator = {
  candidates: compareCandidates,
  packages: comparePackages,
}
