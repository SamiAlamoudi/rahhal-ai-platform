/**
 * Sprint 34 — Feature flag for Payments & Checkout Platform.
 */

import { getFeatureRegistry } from '../ai'

export const PAYMENTS_PLATFORM_FEATURE_ID = 'brain.payments_platform' as const

export function isPaymentsPlatformEnabled(options?: {
  paymentsPlatformEnabled?: boolean
}): boolean {
  if (typeof options?.paymentsPlatformEnabled === 'boolean') {
    return options.paymentsPlatformEnabled
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
    registry.isEnabled('brain.payments_platform')
  )
}
