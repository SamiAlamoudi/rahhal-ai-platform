/**
 * Sprint 32 — AI Conversation Experience public surface.
 */

export type {
  ConversationPhase,
  ConversationCommandKind,
  ConversationMessageRole,
  ConversationMessage,
  ConversationSuggestedAction,
  ConversationStructuredResponse,
  ConversationState,
  ConversationSession,
  ConversationEventType,
  ConversationEvent,
  ConversationTurnInput,
  ConversationTurnResult,
} from './types'

export { isConversationUiEnabled } from './feature'

export {
  ConversationEvents,
  createConversationEvent,
  type ConversationEventListener,
} from './ConversationEvents'

export {
  createInitialConversationState,
  cloneConversationState,
  applyUserTextToState,
  applyCommandToState,
  detectConversationCommand,
} from './ConversationState'

export {
  createConversationMessage,
  createConversationSession,
  appendMessage,
  updateSessionState,
} from './ConversationSession'

export {
  FollowUpQuestionEngine,
  createFollowUpQuestionEngine,
} from './FollowUpQuestionEngine'

export {
  ResponseComposer,
  createResponseComposer,
} from './ResponseComposer'

export {
  ConversationRenderer,
  createConversationRenderer,
} from './ConversationRenderer'

export {
  StreamingResponse,
  streamConversationResponse,
  type StreamingResponseOptions,
} from './StreamingResponse'

export {
  ConversationController,
  getOrCreateConversationController,
  resetConversationController,
  type ConversationControllerOptions,
  type ConversationControllerHandle,
} from './ConversationController'

export {
  createConversationChatProvider,
  type CreateConversationChatProviderOptions,
} from './conversationChatProvider'
