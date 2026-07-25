/**
 * Phase 4 — Conversation Intelligence feature gate.
 *
 * Flag: `ai.conversation_intelligence` (default OFF).
 * When OFF: no enrichment, no behavior change.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const CONVERSATION_INTELLIGENCE_FEATURE_ID = 'ai.conversation_intelligence' as const

export function isConversationIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONVERSATION_INTELLIGENCE_FEATURE_ID)
}
