/**
 * Conversation Brain strategy contracts — pure builders.
 * Coordination strategy hints only; no engine execution.
 */

import type { ConversationBrainStrategyContract } from './types'
import { CONVERSATION_BRAIN_STRATEGY_HINTS } from './types'

export function buildConversationBrainStrategy(): ConversationBrainStrategyContract {
  return {
    kind: 'phase7_conversation_brain_strategy',
    strategyHints: CONVERSATION_BRAIN_STRATEGY_HINTS,
    execution: 'none',
  }
}
