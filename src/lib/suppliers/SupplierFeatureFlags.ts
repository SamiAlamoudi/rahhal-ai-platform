/**
 * Sprint 40 — Feature flag for Supplier Marketplace & Contract Platform.
 */

import { getFeatureRegistry } from '../ai'

export const SUPPLIER_MARKETPLACE_FEATURE_ID = 'brain.supplier_marketplace' as const

export function isSupplierMarketplaceEnabled(options?: {
  supplierMarketplaceEnabled?: boolean
}): boolean {
  if (typeof options?.supplierMarketplaceEnabled === 'boolean') {
    return options.supplierMarketplaceEnabled
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
    registry.isEnabled('brain.supplier_marketplace')
  )
}
