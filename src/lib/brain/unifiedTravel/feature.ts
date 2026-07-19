/**
 * Sprint 31 — FeatureRegistry gate for Unified Travel Planning Engine.
 */

import { getFeatureRegistry } from '../../ai'

export function isUnifiedTravelPlannerEnabled(options?: {
  unifiedTravelPlannerEnabled?: boolean
}): boolean {
  if (typeof options?.unifiedTravelPlannerEnabled === 'boolean') {
    return options.unifiedTravelPlannerEnabled
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
    registry.isEnabled('brain.unified_travel_planner')
  )
}
