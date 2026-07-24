/**
 * Evolution Sprint 4 — Planning Graph feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const PLANNING_GRAPH_FEATURE_ID = 'ai.planning_graph' as const

export function isPlanningGraphEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(PLANNING_GRAPH_FEATURE_ID)
}
