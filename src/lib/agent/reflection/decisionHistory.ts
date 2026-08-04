/**
 * Evolution Sprint 2 — DecisionHistory
 * Append-only history of recommendation decisions / confidence shifts.
 */

import {
  isoNow,
  type DecisionHistoryEntry,
  type RecommendationRecord,
} from './reflectionTypes'

export function appendDecision(
  history: DecisionHistoryEntry[],
  record: RecommendationRecord,
  confidenceBefore: number | null,
  now?: Date,
): DecisionHistoryEntry[] {
  const entry: DecisionHistoryEntry = {
    recordId: record.id,
    timestamp: isoNow(now),
    reasonForChange: record.reasonForChange,
    confidenceBefore,
    confidenceAfter: record.confidence,
    refreshedNodes: [...record.refreshedNodes],
  }
  return [...history, entry]
}

export function latestDecision(history: DecisionHistoryEntry[]): DecisionHistoryEntry | null {
  return history[history.length - 1] ?? null
}

export function decisionCount(history: DecisionHistoryEntry[]): number {
  return history.length
}

export const DecisionHistory = {
  appendDecision,
  latestDecision,
  decisionCount,
}
