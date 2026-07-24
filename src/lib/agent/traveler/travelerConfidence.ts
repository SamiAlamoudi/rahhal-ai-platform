/**
 * Evolution Sprint 5 — TravelerConfidence
 * Overall model confidence from stored preferences.
 */

import { clamp01, type StoredPreference, type TravelerModelState } from './travelerTypes'

export function overallTravelerConfidence(
  preferences: Partial<Record<string, StoredPreference>>,
): number {
  const values = Object.values(preferences).filter(Boolean) as StoredPreference[]
  if (values.length === 0) return 0
  const avg = values.reduce((s, p) => s + p.confidence, 0) / values.length
  const breadth = Math.min(1, values.length / 10)
  const contradictionPenalty =
    values.reduce((s, p) => s + p.contradictions.length, 0) * 0.015
  return clamp01(avg * 0.75 + breadth * 0.25 - contradictionPenalty)
}

export function recordConfidencePoint(
  state: TravelerModelState,
  reason: string,
  now?: Date,
): void {
  const overall = overallTravelerConfidence(state.preferences)
  state.confidenceHistory.push({
    timestamp: (now ?? new Date()).toISOString(),
    overall,
    reason,
  })
}

export const TravelerConfidence = {
  overall: overallTravelerConfidence,
  record: recordConfidencePoint,
}
