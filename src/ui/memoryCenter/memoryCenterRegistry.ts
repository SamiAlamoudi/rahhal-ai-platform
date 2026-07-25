/**
 * Phase 5 Stage 5 — Memory & Knowledge Center feature gate.
 * Flag `ui.memory_center` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const MEMORY_CENTER_FEATURE_ID = 'ui.memory_center' as const

export function isMemoryCenterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(MEMORY_CENTER_FEATURE_ID)
}

export const MemoryCenterRegistry = {
  featureId: MEMORY_CENTER_FEATURE_ID,
  isEnabled: isMemoryCenterEnabled,
}
