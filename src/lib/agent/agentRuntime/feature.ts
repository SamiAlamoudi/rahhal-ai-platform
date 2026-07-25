/**
 * Phase 6 — Agent Runtime feature gate.
 * Flag: `ai.agent_runtime` (default OFF).
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const AGENT_RUNTIME_FEATURE_ID = 'ai.agent_runtime' as const

export function isAgentRuntimeEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(AGENT_RUNTIME_FEATURE_ID)
}
