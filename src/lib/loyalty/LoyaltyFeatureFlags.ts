/**
 * Sprint 38 — Feature flag for Universal Loyalty Platform.
 */

import { getFeatureRegistry } from '../ai'

export const LOYALTY_PLATFORM_FEATURE_ID = 'brain.loyalty_platform' as const

export function isLoyaltyPlatformEnabled(options?: {
  loyaltyPlatformEnabled?: boolean
}): boolean {
  if (typeof options?.loyaltyPlatformEnabled === 'boolean') {
    return options.loyaltyPlatformEnabled
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
    registry.isEnabled('brain.trip_management') &&
    registry.isEnabled('brain.refund_policy_engine') &&
    registry.isEnabled('brain.travel_disruption_engine') &&
    registry.isEnabled('brain.loyalty_platform')
  )
}
