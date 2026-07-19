/**
 * Sprint 33 — Feature flag for booking Travel Execution Engine.
 * Distinct from Sprint 23 `brain.execution` (search-task engine).
 */

import { getFeatureRegistry } from '../ai'

export function isTravelExecutionEngineEnabled(options?: {
  travelExecutionEngineEnabled?: boolean
}): boolean {
  if (typeof options?.travelExecutionEngineEnabled === 'boolean') {
    return options.travelExecutionEngineEnabled
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
    registry.isEnabled('brain.unified_travel_planner') &&
    registry.isEnabled('brain.conversation_ui') &&
    registry.isEnabled('brain.travel_execution_engine')
  )
}

export const TRAVEL_EXECUTION_ENGINE_FEATURE_ID = 'brain.travel_execution_engine' as const
