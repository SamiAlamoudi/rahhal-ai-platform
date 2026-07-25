/**
 * Integration Sprint 8 — `ai.integration_maps_mobility` (default OFF).
 * Optional live adapter gated separately by env/proxy availability; never forced ON.
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_MAPS_MOBILITY_FEATURE_ID =
  'ai.integration_maps_mobility' as const

export function isIntegrationMapsMobilityEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_MAPS_MOBILITY_FEATURE_ID)
}

/** Live Google Maps calls stay OFF unless explicitly requested AND credentials exist. */
export function isIntegrationMapsLiveEnabled(options?: {
  liveEnabled?: boolean
}): boolean {
  if (typeof options?.liveEnabled === 'boolean') return options.liveEnabled
  // Never auto-enable live maps from FeatureRegistry in Sprint 8 — mock is default.
  return false
}
