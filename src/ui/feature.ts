/**
 * Sprint 119 — Rahhal Experience Phase 1 feature flag.
 * `ui.experience_v1` — default OFF.
 */

import { getFeatureRegistry } from '../lib/ai'

export const UI_EXPERIENCE_V1_FEATURE_ID = 'ui.experience_v1' as const

export function isUiExperienceV1Enabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(UI_EXPERIENCE_V1_FEATURE_ID)
}
