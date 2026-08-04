/**
 * Evolution Sprint 5 — Traveler Intelligence feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRAVELER_INTELLIGENCE_FEATURE_ID = 'ai.traveler_intelligence' as const

export function isTravelerIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRAVELER_INTELLIGENCE_FEATURE_ID)
}
