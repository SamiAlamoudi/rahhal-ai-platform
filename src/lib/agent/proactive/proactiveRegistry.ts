/**
 * Phase 3 Stage 3 — Proactive Advisor feature registry helpers.
 * Flag `ai.proactive_advisor` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { ProactiveSignalKind } from './types'

export const PROACTIVE_ADVISOR_FEATURE_ID = 'ai.proactive_advisor' as const

export function isProactiveAdvisorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(PROACTIVE_ADVISOR_FEATURE_ID)
}

/** Stable catalog of supported proactive signals. */
export const PROACTIVE_SIGNAL_CATALOG: readonly ProactiveSignalKind[] = [
  'visa_reminder',
  'passport_expiry_reminder',
  'season_advice',
  'weather_notice',
  'airport_recommendation',
  'hotel_checkin_reminder',
  'transportation_reminder',
  'packing_suggestion',
  'currency_reminder',
  'esim_suggestion',
  'timezone_warning',
  'travel_insurance_reminder',
  'meeting_logistics',
  'executive_travel',
  'family_travel',
  'accessibility',
  'budget_optimization',
  'alternative_timing',
] as const

export const DEFAULT_MAX_PROACTIVE_RECOMMENDATIONS = 5

export const ProactiveRegistry = {
  featureId: PROACTIVE_ADVISOR_FEATURE_ID,
  isEnabled: isProactiveAdvisorEnabled,
  signals: PROACTIVE_SIGNAL_CATALOG,
  defaultMax: DEFAULT_MAX_PROACTIVE_RECOMMENDATIONS,
}
