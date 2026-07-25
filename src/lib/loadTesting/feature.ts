/**
 * Sprint 16 — `load_testing.platform` (default OFF).
 */

import { getFeatureRegistry } from '../ai'

export const LOAD_TESTING_PLATFORM_FEATURE_ID = 'load_testing.platform' as const

export function isLoadTestingPlatformEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(LOAD_TESTING_PLATFORM_FEATURE_ID)
}
