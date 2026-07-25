/**
 * Integration Sprint 10 — `ai.integration_disruption_recovery` (default OFF).
 * Distinct from brain.travel_disruption_engine (Sprint 37).
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID =
  'ai.integration_disruption_recovery' as const

export function isIntegrationDisruptionRecoveryEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID)
}
