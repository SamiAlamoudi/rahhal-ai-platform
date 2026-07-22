/**
 * Sprint 111 — feature flag `ai.concierge_experience`.
 *
 * Shared with Sprint 96 presentation layer (registry default ON).
 * Sprint 111 is an additive consumer; existing Sprint 96 paths are untouched.
 * Pass `{ enabled: false }` to force the disabled path for this layer.
 */

import { getFeatureRegistry } from '../../ai'

export const CONCIERGE_FEATURE_ID = 'ai.concierge_experience' as const

export function isConciergeEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONCIERGE_FEATURE_ID)
}
