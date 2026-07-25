/**
 * Evolution Sprint 8 — Travel Strategy feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRAVEL_STRATEGY_FEATURE_ID = 'ai.travel_strategy' as const

export function isTravelStrategyEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRAVEL_STRATEGY_FEATURE_ID)
}
