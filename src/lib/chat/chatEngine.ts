/**
 * @deprecated Product conversation is TravelBrain only.
 *
 * Thin adapter for residual tests / quarantined voice utilities.
 * Production pages MUST use `useTravelBrain()`.
 *
 * Sole turn owner: TravelBrain.processTurn (see lib/recovery/freeze.ts).
 */

import { getProductBrainController } from '../../brain-ui/productBrain'
import type { ChatAttachment } from './chatAttachments'
import type { ChatConversation, ChatMessage, ChatModality } from './chatTypes'
import type { StreamHandlers } from './chatService'

export interface SendChatMessageInput {
  conversationId: string
  content: string
  modality?: ChatModality
  audioUrl?: string | null
  imageUrl?: string | null
  attachments?: ChatAttachment[]
}

function makeMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  extras?: Partial<ChatMessage>,
): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `brain-${role}-${Date.now()}`,
    conversationId,
    role,
    modality: extras?.modality ?? 'text',
    content,
    audioUrl: extras?.audioUrl ?? null,
    imageUrl: extras?.imageUrl ?? null,
    attachments: extras?.attachments ?? [],
    status: extras?.status ?? 'complete',
    error: null,
    providerMeta: { engine: 'TravelBrain' },
    createdAt: now,
    updatedAt: now,
  }
}

export const chatEngine = {
  listConversations: async (_limit?: number): Promise<ChatConversation[]> => {
    const c = getProductBrainController()
    return c.getState().recentConversations.map((r) => ({
      id: r.id,
      userId: 'rahhal-user',
      title: r.title,
      createdAt: r.updatedAt,
      updatedAt: r.updatedAt,
      lastMessageAt: r.updatedAt,
      messageCount: 0,
    })) as unknown as ChatConversation[]
  },

  createConversation: async (title?: string): Promise<ChatConversation> => {
    const now = new Date().toISOString()
    return {
      id: `brain-conv-${Date.now()}`,
      userId: 'rahhal-user',
      title: title ?? 'TravelBrain',
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
    } as unknown as ChatConversation
  },

  renameConversation: async (id: string, title: string) =>
    ({ id, title }) as unknown as ChatConversation,

  deleteConversation: async (_id: string) => undefined,

  getConversationDetail: async (id: string) => {
    const c = getProductBrainController()
    const messages = c.getConversation().map((m) =>
      makeMessage(id, m.role === 'user' ? 'user' : 'assistant', m.text),
    )
    const now = new Date().toISOString()
    return {
      conversation: {
        id,
        title: 'TravelBrain',
        modalityDefault: 'text',
        travelSessionId: null,
        lastMessagePreview: messages.at(-1)?.content ?? '',
        createdAt: now,
        updatedAt: now,
      } as ChatConversation,
      messages,
    }
  },

  searchConversations: (conversations: ChatConversation[], query: string) => {
    const q = query.toLowerCase()
    return conversations.filter(
      (c) =>
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(q),
    )
  },

  sendMessage: async (input: SendChatMessageInput, handlers: StreamHandlers) => {
    const controller = getProductBrainController()
    if (!controller.getState().ready) {
      await controller.start('rahhal-user', 'ar')
    }
    const user = makeMessage(input.conversationId, 'user', input.content, {
      modality: input.modality ?? 'text',
      audioUrl: input.audioUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      attachments: input.attachments ?? [],
    })
    const placeholder = makeMessage(input.conversationId, 'assistant', '', { status: 'streaming' })
    handlers.onAssistantCreate?.(placeholder)
    try {
      await controller.sendMessage(input.content)
      const last = [...controller.getConversation()].reverse().find((m) => m.role === 'assistant')
      const assistant = makeMessage(input.conversationId, 'assistant', last?.text ?? '')
      handlers.onDelta?.(assistant)
      handlers.onComplete?.(assistant)
      return { user, assistant }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TravelBrain error'
      const failed = {
        ...makeMessage(input.conversationId, 'assistant', message),
        status: 'error' as const,
        error: message,
      }
      handlers.onError?.(failed, message)
      throw err
    }
  },

  retryAssistantMessage: async (
    conversationId: string,
    _assistantMessageId: string,
    handlers: StreamHandlers,
  ) => {
    const lastUser = [...getProductBrainController().getConversation()]
      .reverse()
      .find((m) => m.role === 'user')
    if (!lastUser) throw new Error('Nothing to retry')
    return chatEngine.sendMessage({ conversationId, content: lastUser.text }, handlers)
  },

  supportsModality: (modality: ChatModality): boolean => modality === 'text' || modality === 'audio',
}

export type { ChatConversation, ChatMessage, StreamHandlers }
