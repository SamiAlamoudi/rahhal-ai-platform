/**
 * Sprint 28 — feature flag helper for Conversation Memory & Context Engine.
 */

import { getFeatureRegistry } from '../../ai'

export function isBrainContextMemoryEnabled(options?: {
  brainContextMemoryEnabled?: boolean
}): boolean {
  if (typeof options?.brainContextMemoryEnabled === 'boolean') {
    return options.brainContextMemoryEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution') &&
    registry.isEnabled('brain.search') &&
    registry.isEnabled('brain.trip_orchestrator') &&
    registry.isEnabled('brain.context_memory')
  )
}
