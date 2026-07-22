/**
 * Sprint 106 — feature flag `ai.response_composer` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const RESPONSE_COMPOSER_FEATURE_ID = 'ai.response_composer' as const

export function isResponseComposerEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(RESPONSE_COMPOSER_FEATURE_ID)
}
