/**
 * Phase 4 Stage 2 — Conversation Center feature gate.
 * Flag `ui.conversation_center` default OFF.
 * Not wired into production routes / main.tsx / Runtime Coordinator / Orchestrator.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const CONVERSATION_CENTER_FEATURE_ID = 'ui.conversation_center' as const

export function isConversationCenterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONVERSATION_CENTER_FEATURE_ID)
}

export const ConversationCenterRegistry = {
  featureId: CONVERSATION_CENTER_FEATURE_ID,
  isEnabled: isConversationCenterEnabled,
}
