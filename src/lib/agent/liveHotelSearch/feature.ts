/**
 * Sprint 109 — feature flag `ai.live_hotel_search` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const LIVE_HOTEL_SEARCH_FEATURE_ID = 'ai.live_hotel_search' as const

export function isLiveHotelSearchEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(LIVE_HOTEL_SEARCH_FEATURE_ID)
}
