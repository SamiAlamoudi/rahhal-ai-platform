/**
 * Evolution Sprint 7 — Destination Intelligence feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const DESTINATION_INTELLIGENCE_FEATURE_ID = 'ai.destination_intelligence' as const

export function isDestinationIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(DESTINATION_INTELLIGENCE_FEATURE_ID)
}
