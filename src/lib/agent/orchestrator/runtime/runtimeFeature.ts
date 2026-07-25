/**
 * Phase 2 Stage 4 — feature gate `ai.runtime_coordinator` (default OFF).
 */

import { getFeatureRegistry } from '../../../ai/featureFlags'

export const RUNTIME_COORDINATOR_FEATURE_ID = 'ai.runtime_coordinator' as const

export function isRuntimeCoordinatorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(RUNTIME_COORDINATOR_FEATURE_ID)
}
