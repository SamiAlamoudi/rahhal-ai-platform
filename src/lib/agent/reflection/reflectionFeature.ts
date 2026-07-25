/**
 * Evolution Sprint 2 — Consultant Reflection feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const CONSULTANT_REFLECTION_FEATURE_ID = 'ai.consultant_reflection' as const

export function isConsultantReflectionEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONSULTANT_REFLECTION_FEATURE_ID)
}
