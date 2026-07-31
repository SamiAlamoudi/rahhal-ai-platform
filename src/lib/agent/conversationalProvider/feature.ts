/**
 * Sprint 80 P1-3 — feature flag `ai.conversational_provider_unify` (default OFF).
 *
 * When OFF, conversational search keeps using existing toolBridge paths unchanged.
 * When ON, toolBridge routes through the unified provider layer (same backends).
 */

import { getFeatureRegistry } from '../../ai'

export const CONVERSATIONAL_PROVIDER_UNIFY_FEATURE_ID =
  'ai.conversational_provider_unify' as const

export function isConversationalProviderUnifyEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONVERSATIONAL_PROVIDER_UNIFY_FEATURE_ID)
}
