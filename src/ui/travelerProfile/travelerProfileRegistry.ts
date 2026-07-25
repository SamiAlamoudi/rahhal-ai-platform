/**
 * Phase 5 Stage 4 — Traveler Profile Center feature gate.
 * Flag `ui.traveler_profile` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const TRAVELER_PROFILE_FEATURE_ID = 'ui.traveler_profile' as const

export function isTravelerProfileEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRAVELER_PROFILE_FEATURE_ID)
}

export const TravelerProfileRegistry = {
  featureId: TRAVELER_PROFILE_FEATURE_ID,
  isEnabled: isTravelerProfileEnabled,
}
