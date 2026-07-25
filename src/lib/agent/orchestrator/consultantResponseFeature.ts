/**
 * Phase 2 Stage 3 — feature gate `ai.consultant_response` (default OFF).
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const CONSULTANT_RESPONSE_FEATURE_ID = 'ai.consultant_response' as const

export function isConsultantResponseEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONSULTANT_RESPONSE_FEATURE_ID)
}
