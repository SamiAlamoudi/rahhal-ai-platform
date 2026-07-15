/**
 * Public chat module surface.
 * Text UI and future Voice Conversation should import from here or `chatEngine`.
 */

export { chatEngine, type SendChatMessageInput } from './chatEngine'
export { chatService, type StreamHandlers, type SendUserMessageOptions } from './chatService'
export {
  conversationFromRow,
  messageFromRow,
  type ChatConversation,
  type ChatMessage,
  type ChatModality,
  type ChatProvider,
  type ChatStreamChunk,
} from './chatTypes'
export {
  CHAT_ATTACHMENTS_ENABLED,
  uploadChatAttachment,
  normalizeAttachments,
  type ChatAttachment,
} from './chatAttachments'
export {
  filterConversations,
  validateConversationTitle,
  validateUserMessage,
  parseMarkdownBlocks,
} from './chatHelpers'
