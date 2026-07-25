/**
 * Integration Sprint 12 — `ai.integration_journey` (default OFF).
 * Coordinator only; does not replace child integration flags.
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_JOURNEY_FEATURE_ID = 'ai.integration_journey' as const

export function isIntegrationJourneyEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_JOURNEY_FEATURE_ID)
}
