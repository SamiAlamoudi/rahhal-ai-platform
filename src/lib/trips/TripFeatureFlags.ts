/**
 * Sprint 35 — Feature flag for Post Booking & Trip Management.
 */

import { getFeatureRegistry } from '../ai'

export const TRIP_MANAGEMENT_FEATURE_ID = 'brain.trip_management' as const

export function isTripManagementEnabled(options?: {
  tripManagementEnabled?: boolean
}): boolean {
  if (typeof options?.tripManagementEnabled === 'boolean') {
    return options.tripManagementEnabled
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
    registry.isEnabled('brain.travel_execution_engine') &&
    registry.isEnabled('brain.payments_platform') &&
    registry.isEnabled('brain.trip_management')
  )
}
