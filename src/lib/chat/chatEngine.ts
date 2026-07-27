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
import { thinkingEvidence } from './voice/thinkingStuckEvidence'

export interface SendChatMessageInput {
  conversationId: string
  content: string
  /** text today; audio for Voice Conversation later */
  modality?: ChatModality
  audioUrl?: string | null
  imageUrl?: string | null
  attachments?: ChatAttachment[]
}

function evidenceOnlySendMessage(
  input: SendChatMessageInput,
  handlers: StreamHandlers,
) {
  const conversationId = input.conversationId
  thinkingEvidence('REQUEST_START', {
    conversationId,
    nextState: 'THINKING',
    waitingComponent: 'chatEngine.sendMessage',
    meta: {
      modality: input.modality ?? 'text',
      contentLen: input.content.trim().length,
      signalAborted: handlers.signal?.aborted === true,
    },
  })

  const onAbort = () => {
    thinkingEvidence('REQUEST_ABORT', {
      conversationId,
      success: false,
      errorReason: 'AbortSignal.aborted',
      waitingComponent: 'chatEngine.sendMessage',
    })
  }
  handlers.signal?.addEventListener('abort', onAbort, { once: true })

  const timeoutMs = 25_000
  const timeout = setTimeout(() => {
    thinkingEvidence('REQUEST_TIMEOUT', {
      conversationId,
      success: false,
      errorReason: 'chatEngine_request_timeout_25s',
      waitingComponent: 'chatEngine.sendMessage',
      meta: { timeoutMs },
    })
  }, timeoutMs)

  const wrapped: StreamHandlers = {
    ...handlers,
    onAssistantCreate: (message) => {
      thinkingEvidence('REQUEST_SENT', {
        conversationId,
        assistantMessageId: message.id,
        waitingComponent: 'chatEngine.onAssistantCreate',
        meta: { phase: 'assistant_seed', status: message.status },
      })
      handlers.onAssistantCreate?.(message)
    },
    onDelta: (message) => {
      thinkingEvidence('RESPONSE_RECEIVED', {
        conversationId,
        assistantMessageId: message.id,
        waitingComponent: 'chatEngine.onDelta',
        meta: { contentLen: message.content.length, status: message.status },
      })
      handlers.onDelta?.(message)
    },
    onComplete: (message) => {
      thinkingEvidence('RESPONSE_PARSED', {
        conversationId,
        assistantMessageId: message.id,
        waitingComponent: 'chatEngine.onComplete',
        meta: { contentLen: message.content.length, status: message.status },
      })
      handlers.onComplete?.(message)
    },
    onError: (message, error) => {
      const aborted = handlers.signal?.aborted === true
      thinkingEvidence(aborted ? 'REQUEST_ABORT' : 'REQUEST_ERROR', {
        conversationId,
        assistantMessageId: message.id,
        success: false,
        errorReason: error,
        waitingComponent: 'chatEngine.onError',
      })
      handlers.onError?.(message, error)
    },
  }

  return Promise.resolve(
    chatService.sendUserMessage(input.conversationId, input.content, wrapped, {
      modality: input.modality,
      audioUrl: input.audioUrl,
      imageUrl: input.imageUrl,
      attachments: input.attachments,
    }),
  )
    .then((result) => {
      thinkingEvidence('RESPONSE_PARSED', {
        conversationId,
        assistantMessageId: result.assistant.id,
        waitingComponent: 'chatEngine.sendMessage.resolved',
        meta: {
          phase: 'promise_resolved',
          assistantStatus: result.assistant.status,
          assistantLen: result.assistant.content.length,
        },
      })
      return result
    })
    .catch((error: unknown) => {
      const aborted = handlers.signal?.aborted === true
      thinkingEvidence(aborted ? 'REQUEST_ABORT' : 'REQUEST_ERROR', {
        conversationId,
        success: false,
        errorReason: error instanceof Error ? error.message : String(error),
        waitingComponent: 'chatEngine.sendMessage.threw',
      })
      throw error
    })
    .finally(() => {
      clearTimeout(timeout)
      handlers.signal?.removeEventListener('abort', onAbort)
    })
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
   * Evidence hooks are Preview-only logs — they do not alter send semantics.
   */
  sendMessage: (input: SendChatMessageInput, handlers: StreamHandlers) =>
    evidenceOnlySendMessage(input, handlers),

  retryAssistantMessage: (
    conversationId: string,
    assistantMessageId: string,
    handlers: StreamHandlers,
  ) => chatService.retryAssistantMessage(conversationId, assistantMessageId, handlers),

  /** Convenience marker for Voice integrators */
  supportsModality: (modality: ChatModality): boolean => modality === 'text' || modality === 'audio',
}

export type { ChatConversation, ChatMessage, StreamHandlers }
