/**
 * Integration Sprint 4 — `ai.integration_trip_orchestrator` (default OFF).
 * Distinct from quarantined `ai.orchestrator` / `brain.trip_orchestrator`.
 */

import { getFeatureRegistry } from '../../ai'

export const INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID = 'ai.integration_trip_orchestrator' as const

export function isIntegrationTripOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID)
}
