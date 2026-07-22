/**
 * Sprint 114 — feature flag `ai.itinerary_engine` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const ITINERARY_ENGINE_FEATURE_ID = 'ai.itinerary_engine' as const

export function isItineraryEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(ITINERARY_ENGINE_FEATURE_ID)
}
