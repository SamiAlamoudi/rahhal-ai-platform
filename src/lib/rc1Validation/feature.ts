/**
 * Sprint 18 — `rc1.validation` (default OFF).
 */

import { getFeatureRegistry } from '../ai'

export const RC1_VALIDATION_FEATURE_ID = 'rc1.validation' as const

export function isRc1ValidationEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(RC1_VALIDATION_FEATURE_ID)
}
