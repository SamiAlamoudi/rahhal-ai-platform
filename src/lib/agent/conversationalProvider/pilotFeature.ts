/**
 * Sprint 80 P1-4 — feature flag `ai.live_flight_provider_pilot` (default OFF).
 *
 * When OFF, runConversationAwareFlightSearch keeps the pre-pilot bridges.
 * When ON, flights route through the unified provider resolver (Amadeus) with
 * silent legacy fallback. Hotels are not included.
 */

import { getFeatureRegistry } from '../../ai'

export const LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID =
  'ai.live_flight_provider_pilot' as const

export function isLiveFlightProviderPilotEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID)
}
