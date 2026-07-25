/**
 * Phase 5 — LLM Conversation Brain feature gate.
 * Flag: `ai.llm_conversation_brain` (default OFF).
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const LLM_CONVERSATION_BRAIN_FEATURE_ID = 'ai.llm_conversation_brain' as const

export function isLlmConversationBrainEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(LLM_CONVERSATION_BRAIN_FEATURE_ID)
}
