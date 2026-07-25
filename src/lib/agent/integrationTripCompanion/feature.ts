/**
 * Integration Sprint 7 — `ai.integration_trip_companion` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_TRIP_COMPANION_FEATURE_ID =
  'ai.integration_trip_companion' as const

export function isIntegrationTripCompanionEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_TRIP_COMPANION_FEATURE_ID)
}
