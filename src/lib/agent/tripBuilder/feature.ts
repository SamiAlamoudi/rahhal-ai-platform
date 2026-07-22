/**
 * Sprint 110 — feature flag `ai.trip_builder` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const TRIP_BUILDER_FEATURE_ID = 'ai.trip_builder' as const

export function isTripBuilderEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRIP_BUILDER_FEATURE_ID)
}
