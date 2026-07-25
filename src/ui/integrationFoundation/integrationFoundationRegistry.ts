/**
 * Phase 6 Stage 1 — Integration Foundation feature gate.
 * Flag `ui.integration_foundation` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const INTEGRATION_FOUNDATION_FEATURE_ID =
  'ui.integration_foundation' as const

export function isIntegrationFoundationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_FOUNDATION_FEATURE_ID)
}

export const IntegrationFoundationRegistry = {
  featureId: INTEGRATION_FOUNDATION_FEATURE_ID,
  isEnabled: isIntegrationFoundationEnabled,
}
