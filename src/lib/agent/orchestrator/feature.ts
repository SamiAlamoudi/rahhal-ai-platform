/**
 * Sprint 113 — feature flag `ai.orchestrator` (default OFF).
 * Named distinctly from Sprint 43 `brain.ai_orchestrator` helpers.
 */

import { getFeatureRegistry } from '../../ai'

/** Feature id string: `ai.orchestrator` */
export const PIPELINE_ORCHESTRATOR_FEATURE_ID = 'ai.orchestrator' as const

export function isPipelineOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(PIPELINE_ORCHESTRATOR_FEATURE_ID)
}

/** Sprint 113 enablement helper (not Sprint 43 `isAiOrchestratorEnabled`). */
export function isAgentPipelineOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  return isPipelineOrchestratorEnabled(options)
}
