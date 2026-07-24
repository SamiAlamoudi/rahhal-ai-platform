/**
 * Phase 3 Stage 3 — Prioritize proactive recommendations.
 */

import { getSignalDefinition } from './proactiveSignals'
import type { ProactiveRecommendation } from './types'

export function compareProactivePriority(
  a: ProactiveRecommendation,
  b: ProactiveRecommendation,
): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  if (b.confidence !== a.confidence) return b.confidence - a.confidence
  return a.signal.localeCompare(b.signal)
}

export function computeProactivePriority(input: {
  signal: ProactiveRecommendation['signal']
  confidence: number
  clarificationRequired: boolean
}): number {
  const base = getSignalDefinition(input.signal).defaultPriority
  const confidenceBoost = Math.round(input.confidence * 20)
  const clarifyPenalty = input.clarificationRequired ? 8 : 0
  return Math.max(1, base + confidenceBoost - clarifyPenalty)
}

export function rankProactiveRecommendations(
  recommendations: ProactiveRecommendation[],
  max: number,
): ProactiveRecommendation[] {
  return [...recommendations].sort(compareProactivePriority).slice(0, Math.max(0, max))
}

export const ProactivePriority = {
  compare: compareProactivePriority,
  compute: computeProactivePriority,
  rank: rankProactiveRecommendations,
}
