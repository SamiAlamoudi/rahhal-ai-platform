/**
 * Sprint 104 — feature flag `ai.live_provider_gateway` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const LIVE_PROVIDER_GATEWAY_FEATURE_ID = 'ai.live_provider_gateway' as const

export function isLiveProviderGatewayEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(LIVE_PROVIDER_GATEWAY_FEATURE_ID)
}
