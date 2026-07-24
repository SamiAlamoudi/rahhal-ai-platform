/**
 * Evolution Sprint 1 — Consultant Reasoning feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const CONSULTANT_REASONING_FEATURE_ID = 'ai.consultant_reasoning' as const

export function isConsultantReasoningEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONSULTANT_REASONING_FEATURE_ID)
}
