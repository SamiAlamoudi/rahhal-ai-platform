/**
 * Phase 2 Stage 1 — Consultant feature gate + stage order helpers.
 * Default OFF. Not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import {
  CONSULTANT_STAGE_ORDER,
  type ConsultantStageId,
} from './pipelineTypes'
import { CONSULTANT_PIPELINE_FEATURE_ID } from './integrationRegistry'

export { CONSULTANT_PIPELINE_FEATURE_ID }

export function isConsultantPipelineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONSULTANT_PIPELINE_FEATURE_ID)
}

/** Execution stages before unified response composition. */
export const EXECUTION_STAGE_ORDER: readonly ConsultantStageId[] =
  CONSULTANT_STAGE_ORDER.filter((id) => id !== 'unified_response')

export function nextStage(
  current: ConsultantStageId | null,
): ConsultantStageId | null {
  if (current == null) return CONSULTANT_STAGE_ORDER[0] ?? null
  const idx = CONSULTANT_STAGE_ORDER.indexOf(current)
  if (idx < 0 || idx >= CONSULTANT_STAGE_ORDER.length - 1) return null
  return CONSULTANT_STAGE_ORDER[idx + 1]!
}

export const ConsultantStages = {
  order: CONSULTANT_STAGE_ORDER,
  executionOrder: EXECUTION_STAGE_ORDER,
  next: nextStage,
  isEnabled: isConsultantPipelineEnabled,
  featureId: CONSULTANT_PIPELINE_FEATURE_ID,
}
