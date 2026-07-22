/**
 * Sprint 121 — Premium Home Experience flag helper.
 * `ui.premium_home` — default OFF. Presentation polish only.
 */

import { getFeatureRegistry } from '../../lib/ai'

export const UI_PREMIUM_HOME_FEATURE_ID = 'ui.premium_home' as const

export function isUiPremiumHomeEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(UI_PREMIUM_HOME_FEATURE_ID)
}
