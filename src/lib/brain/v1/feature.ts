/**
 * Sprint 81/82 — feature flag `ai.brain.v1` (default OFF).
 *
 * Distinct from production `ai.rahhal_brain` and frozen `brain.*` flags.
 * When OFF: runBrainV1Turn returns enabled:false without side effects.
 * Not wired into travelAgentService.planTurn / Voice / UI.
 * Sprint 82 reasoning remains behind this same flag.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const BRAIN_V1_FEATURE_ID = 'ai.brain.v1' as const

export function isBrainV1Enabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)
}
