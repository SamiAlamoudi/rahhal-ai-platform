/**
 * Sprint 118 — Editable AI Conversation feature flag.
 * `ai.editable_conversation` — default OFF.
 */

import { getFeatureRegistry } from '../../ai'

export const EDITABLE_CONVERSATION_FEATURE_ID = 'ai.editable_conversation' as const

export function isEditableConversationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(EDITABLE_CONVERSATION_FEATURE_ID)
}
