/**
 * Sprint 79 — duplicate elimination across plan results.
 */

import type { SearchCandidate } from '../types'

/**
 * Keep the highest-scoring (or first) candidate per normalizedKey.
 */
export function dedupeCandidates(candidates: SearchCandidate[]): {
  unique: SearchCandidate[]
  duplicateCount: number
} {
  const best = new Map<string, SearchCandidate>()
  let duplicateCount = 0

  for (const candidate of candidates) {
    const existing = best.get(candidate.normalizedKey)
    if (!existing) {
      best.set(candidate.normalizedKey, candidate)
      continue
    }
    duplicateCount += 1
    const existingScore = existing.score?.overall ?? -1
    const nextScore = candidate.score?.overall ?? -1
    if (nextScore > existingScore
      || (nextScore === existingScore && candidate.totalPrice < existing.totalPrice)) {
      best.set(candidate.normalizedKey, {
        ...candidate,
        // Preserve that multiple plans produced this itinerary
        planId: `${existing.planId}+${candidate.planId}`,
      })
    }
  }

  return { unique: [...best.values()], duplicateCount }
}
