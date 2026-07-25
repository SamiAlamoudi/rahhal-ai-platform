/**
 * Phase 5 Stage 3 — Insights Center feature gate.
 * Flag `ui.insights_center` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const INSIGHTS_CENTER_FEATURE_ID = 'ui.insights_center' as const

export function isInsightsCenterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INSIGHTS_CENTER_FEATURE_ID)
}

export const InsightsCenterRegistry = {
  featureId: INSIGHTS_CENTER_FEATURE_ID,
  isEnabled: isInsightsCenterEnabled,
}
