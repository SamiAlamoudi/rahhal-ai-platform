/**
 * Sprint 112 — feature flag `ai.memory_engine` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const MEMORY_ENGINE_FEATURE_ID = 'ai.memory_engine' as const

export function isMemoryEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(MEMORY_ENGINE_FEATURE_ID)
}
