/**
 * Sprint 115 — Unified AI Execution Pipeline feature flag.
 * `ai.execution_pipeline` — default OFF.
 */

import { getFeatureRegistry } from '../../ai'

export const EXECUTION_PIPELINE_FEATURE_ID = 'ai.execution_pipeline' as const

export function isExecutionPipelineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(EXECUTION_PIPELINE_FEATURE_ID)
}
