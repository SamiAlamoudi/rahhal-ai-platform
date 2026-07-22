/**
 * Sprint 105 — feature flag `ai.live_flight_search` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const LIVE_FLIGHT_SEARCH_FEATURE_ID = 'ai.live_flight_search' as const

export function isLiveFlightSearchEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(LIVE_FLIGHT_SEARCH_FEATURE_ID)
}
