/**
 * Integration Sprint 5 — `ai.integration_destination_intelligence` (default OFF).
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID =
  'ai.integration_destination_intelligence' as const

export function isIntegrationDestinationIntelligenceEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID)
}
