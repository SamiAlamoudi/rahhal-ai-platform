/**
 * RC2 — `rc2.ga_review` (default OFF).
 */

import { getFeatureRegistry } from '../ai'

export const RC2_GA_REVIEW_FEATURE_ID = 'rc2.ga_review' as const

export function isRc2GaReviewEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(RC2_GA_REVIEW_FEATURE_ID)
}
