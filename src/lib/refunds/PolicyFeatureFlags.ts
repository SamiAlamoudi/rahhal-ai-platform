/**
 * Sprint 36 — Feature flag for Universal Cancellation & Refund Policy Engine.
 */

import { getFeatureRegistry } from '../ai'

export const REFUND_POLICY_ENGINE_FEATURE_ID = 'brain.refund_policy_engine' as const

export function isRefundPolicyEngineEnabled(options?: {
  refundPolicyEngineEnabled?: boolean
}): boolean {
  if (typeof options?.refundPolicyEngineEnabled === 'boolean') {
    return options.refundPolicyEngineEnabled
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
    registry.isEnabled('brain.refund_policy_engine')
  )
}
