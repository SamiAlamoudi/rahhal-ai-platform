/**
 * Phase 5 Stage 2 — Decision Center feature gate.
 * Flag `ui.decision_center` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const DECISION_CENTER_FEATURE_ID = 'ui.decision_center' as const

export function isDecisionCenterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(DECISION_CENTER_FEATURE_ID)
}

export const DecisionCenterRegistry = {
  featureId: DECISION_CENTER_FEATURE_ID,
  isEnabled: isDecisionCenterEnabled,
}
