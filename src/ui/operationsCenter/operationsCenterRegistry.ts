/**
 * Phase 5 Stage 7 — Operations Center feature gate.
 * Flag `ui.operations_center` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const OPERATIONS_CENTER_FEATURE_ID = 'ui.operations_center' as const

export function isOperationsCenterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(OPERATIONS_CENTER_FEATURE_ID)
}

export const OperationsCenterRegistry = {
  featureId: OPERATIONS_CENTER_FEATURE_ID,
  isEnabled: isOperationsCenterEnabled,
}
