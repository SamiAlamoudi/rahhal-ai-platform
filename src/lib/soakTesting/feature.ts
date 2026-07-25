/**
 * Sprint 19 — `soak.staging` (default OFF).
 */

import { getFeatureRegistry } from '../ai'

export const SOAK_STAGING_FEATURE_ID = 'soak.staging' as const

export function isSoakStagingEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(SOAK_STAGING_FEATURE_ID)
}
