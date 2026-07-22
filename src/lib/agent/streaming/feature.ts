/**
 * Sprint 116 — AI Streaming Conversation feature flag.
 * `ai.streaming_conversation` — default OFF.
 */

import { getFeatureRegistry } from '../../ai'

export const STREAMING_CONVERSATION_FEATURE_ID = 'ai.streaming_conversation' as const

export function isStreamingConversationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(STREAMING_CONVERSATION_FEATURE_ID)
}
