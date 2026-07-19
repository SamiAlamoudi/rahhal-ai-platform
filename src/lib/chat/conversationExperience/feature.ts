/**
 * Sprint 32 — FeatureRegistry gate for AI Conversation Experience.
 */

import { getFeatureRegistry } from '../../ai'

export function isConversationUiEnabled(options?: {
  conversationUiEnabled?: boolean
}): boolean {
  if (typeof options?.conversationUiEnabled === 'boolean') {
    return options.conversationUiEnabled
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
    registry.isEnabled('brain.conversation_ui')
  )
}
