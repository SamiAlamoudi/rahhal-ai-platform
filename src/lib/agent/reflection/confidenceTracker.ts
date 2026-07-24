/**
 * Evolution Sprint 2 — ConfidenceTracker
 * Records confidence evolution across turns / nodes.
 */

import { clamp01 } from '../reasoning/consultantTypes'
import {
  isoNow,
  type CachedReasoningNodes,
  type ConfidencePoint,
  type ReasoningNodeId,
} from './reflectionTypes'

export function snapshotConfidence(
  nodes: CachedReasoningNodes,
  reason: string,
  now?: Date,
): ConfidencePoint {
  const byNode: Partial<Record<ReasoningNodeId, number>> = {}
  const entries: Array<[ReasoningNodeId, number | null | undefined]> = [
    ['intent', nodes.intent?.confidence],
    ['profile', nodes.profile?.confidence],
    ['constraints', nodes.constraints?.confidence],
    ['destination', nodes.destination?.confidence],
    ['budget', nodes.budget?.confidence],
    ['risk', nodes.risk?.confidence],
    ['value', nodes.value?.confidence],
    ['recommendation', nodes.recommendation?.confidence],
    ['explanation', nodes.explanation?.confidence],
  ]
  const values: number[] = []
  for (const [id, c] of entries) {
    if (typeof c === 'number') {
      byNode[id] = clamp01(c)
      values.push(c)
    }
  }
  const overall = values.length
    ? clamp01(values.reduce((a, b) => a + b, 0) / values.length)
    : 0
  return {
    timestamp: isoNow(now),
    overall,
    byNode,
    reason,
  }
}

export function confidenceDelta(
  history: ConfidencePoint[],
): { before: number | null; after: number; delta: number } {
  if (history.length === 0) return { before: null, after: 0, delta: 0 }
  const after = history[history.length - 1]!.overall
  const before = history.length >= 2 ? history[history.length - 2]!.overall : null
  return {
    before,
    after,
    delta: before == null ? after : after - before,
  }
}

export function latestOverallConfidence(history: ConfidencePoint[]): number {
  return history[history.length - 1]?.overall ?? 0
}

export const ConfidenceTracker = {
  snapshotConfidence,
  confidenceDelta,
  latestOverallConfidence,
}
