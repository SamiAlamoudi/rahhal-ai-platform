/**
 * Sprint 41 — Feature flag for Finance / Revenue / Settlement Platform.
 */

import { getFeatureRegistry } from '../ai'

export const FINANCE_PLATFORM_FEATURE_ID = 'brain.finance_platform' as const

export function isFinancePlatformEnabled(options?: {
  financePlatformEnabled?: boolean
}): boolean {
  if (typeof options?.financePlatformEnabled === 'boolean') {
    return options.financePlatformEnabled
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
    registry.isEnabled('brain.loyalty_platform') &&
    registry.isEnabled('brain.travel_documents') &&
    registry.isEnabled('brain.supplier_marketplace') &&
    registry.isEnabled('brain.finance_platform')
  )
}
