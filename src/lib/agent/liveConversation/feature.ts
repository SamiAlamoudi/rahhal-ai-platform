import { getFeatureRegistry } from '../../ai'

export const LIVE_CONVERSATION_FEATURE_ID = 'ai.live_conversation' as const

export function isLiveConversationEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.live_conversation')
}
