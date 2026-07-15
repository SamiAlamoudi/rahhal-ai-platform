/**
 * Shared Chat Engine — single entry point for Text UI and upcoming Voice Conversation.
 *
 * Voice MUST:
 * - Use the same Conversation + Message models (`chatTypes`)
 * - Persist via the same repositories / tables (`conversations`, `messages`)
 * - Call this engine (or `chatService` beneath it) for send / stream / retry / stop
 * - Set `modality: 'audio'` (+ `audioUrl`) instead of inventing a parallel voice stack
 *
 * Voice is another interface to this engine, not a separate implementation.
 */

import { chatService, type StreamHandlers } from './chatService'
import type { ChatConversation, ChatMessage, ChatModality } from './chatTypes'
import type { ChatAttachment } from './chatAttachments'

export interface SendChatMessageInput {
  conversationId: string
  content: string
  /** text today; audio for Voice Conversation later */
  modality?: ChatModality
  audioUrl?: string | null
  imageUrl?: string | null
  attachments?: ChatAttachment[]
}

export const chatEngine = {
  listConversations: (limit?: number) => chatService.listConversations(limit),
  createConversation: (title?: string) => chatService.createConversation(title),
  renameConversation: (id: string, title: string) => chatService.renameConversation(id, title),
  deleteConversation: (id: string) => chatService.deleteConversation(id),
  getConversationDetail: (id: string) => chatService.getConversationDetail(id),
  searchConversations: (
    conversations: ChatConversation[],
    query: string,
  ) => chatService.searchConversations(conversations, query),

  /**
   * Unified send path for text composer and future voice turn ingestion.
   * Voice should pass modality:'audio' and an audioUrl/transcript in content.
   */
  sendMessage: (input: SendChatMessageInput, handlers: StreamHandlers) =>
    chatService.sendUserMessage(input.conversationId, input.content, handlers, {
      modality: input.modality,
      audioUrl: input.audioUrl,
      imageUrl: input.imageUrl,
      attachments: input.attachments,
    }),

  retryAssistantMessage: (
    conversationId: string,
    assistantMessageId: string,
    handlers: StreamHandlers,
  ) => chatService.retryAssistantMessage(conversationId, assistantMessageId, handlers),

  /** Convenience marker for Voice integrators */
  supportsModality: (modality: ChatModality): boolean => modality === 'text' || modality === 'audio',
}

export type { ChatConversation, ChatMessage, StreamHandlers }
