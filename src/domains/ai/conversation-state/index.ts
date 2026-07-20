/** AI sub-module shim — conversation-state. */
export {
  createInitialConversationState,
  cloneConversationState,
  applyUserTextToState,
  applyCommandToState,
  detectConversationCommand,
  createConversationMessage,
  createConversationSession,
  appendMessage,
  updateSessionState,
  ConversationController,
  getOrCreateConversationController,
  resetConversationController,
} from '../../../lib/chat'
export type {
  ConversationMemory,
  ConversationHistory,
  ConversationContext,
  ConversationHistoryTurn,
  BrainMemorySlot,
} from '../../../lib/brain/types'
export * from '../../../lib/brain/conversationMemory'
