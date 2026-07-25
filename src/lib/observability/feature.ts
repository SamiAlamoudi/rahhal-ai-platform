/**
 * Sprint 15 — `observability.platform` (default OFF).
 */

import { getFeatureRegistry } from '../ai'

export const OBSERVABILITY_PLATFORM_FEATURE_ID = 'observability.platform' as const

export function isObservabilityPlatformEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(OBSERVABILITY_PLATFORM_FEATURE_ID)
}
