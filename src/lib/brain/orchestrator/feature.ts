/**
 * Sprint 27 — feature flag helper for AI Trip Orchestrator.
 */

import { getFeatureRegistry } from '../../ai'

export function isBrainTripOrchestratorEnabled(options?: {
  brainTripOrchestratorEnabled?: boolean
}): boolean {
  if (typeof options?.brainTripOrchestratorEnabled === 'boolean') {
    return options.brainTripOrchestratorEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution') &&
    registry.isEnabled('brain.search') &&
    registry.isEnabled('brain.trip_orchestrator')
  )
}
