/**
 * Conversation Brain lifecycle contracts — pure builders.
 * Declarative actions only; no state machine execution.
 */

import type { ConversationBrainLifecycleContract } from './types'
import { CONVERSATION_BRAIN_LIFECYCLE_ACTIONS } from './types'

export function buildConversationBrainLifecycle(): ConversationBrainLifecycleContract {
  return {
    kind: 'phase7_conversation_brain_lifecycle',
    actions: CONVERSATION_BRAIN_LIFECYCLE_ACTIONS,
    currentActionHint: null,
    execution: 'none',
  }
}
