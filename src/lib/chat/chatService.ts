import { conversationRepository } from '../repositories/conversationRepository'
import { messageRepository } from '../repositories/messageRepository'
import { createChatProvider } from './chatProviderFactory'
import type { ChatProvider } from './chatTypes'
import {
  conversationFromRow,
  messageFromRow,
  type ChatConversation,
  type ChatMessage,
} from './chatTypes'
import {
  findRetryTarget,
  titleFromFirstMessage,
  validateConversationTitle,
  validateUserMessage,
} from './chatHelpers'

export interface ConversationDetail {
  conversation: ChatConversation
  messages: ChatMessage[]
}

export interface StreamHandlers {
  signal: AbortSignal
  onAssistantCreate?: (message: ChatMessage) => void
  onDelta?: (message: ChatMessage) => void
  onComplete?: (message: ChatMessage) => void
  onError?: (message: ChatMessage, error: string) => void
}

let activeProvider: ChatProvider = createChatProvider()

export function setChatProviderForTests(provider: ChatProvider): void {
  activeProvider = provider
}

export function resetChatProviderForTests(): void {
  activeProvider = createChatProvider()
}

async function persistAssistantDelta(
  messageId: string,
  content: string,
  status: string,
  error: string | null = null,
): Promise<ChatMessage | null> {
  const row = await messageRepository.update(messageId, {
    content,
    status,
    error,
    provider_meta: { providerId: activeProvider.providerId },
  })
  return row ? messageFromRow(row) : null
}

async function streamIntoAssistant(
  conversationId: string,
  history: ChatMessage[],
  assistantId: string,
  handlers: StreamHandlers,
): Promise<ChatMessage> {
  let content = ''
  let lastPersistedLength = 0
  let latest: ChatMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    modality: 'text',
    content: '',
    audioUrl: null,
    status: 'streaming',
    error: null,
    providerMeta: { providerId: activeProvider.providerId },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    for await (const chunk of activeProvider.streamReply({
      conversationId,
      messages: history,
      signal: handlers.signal,
    })) {
      if (chunk.type === 'delta' && chunk.text) {
        content += chunk.text
        latest = {
          ...latest,
          content,
          status: 'streaming',
          updatedAt: new Date().toISOString(),
        }
        handlers.onDelta?.(latest)
        // Persist periodically for crash-safe streaming history
        if (content.length - lastPersistedLength >= 120) {
          const saved = await persistAssistantDelta(assistantId, content, 'streaming')
          if (saved) latest = saved
          lastPersistedLength = content.length
        }
      } else if (chunk.type === 'error') {
        const err = chunk.error === 'cancelled' ? 'cancelled' : (chunk.error ?? 'stream error')
        const status = err === 'cancelled' ? 'cancelled' : 'error'
        const saved = await persistAssistantDelta(assistantId, content, status, err)
        latest = saved ?? { ...latest, status, error: err, content }
        handlers.onError?.(latest, err)
        return latest
      } else if (chunk.type === 'done') {
        const saved = await persistAssistantDelta(assistantId, content, 'complete')
        latest = saved ?? { ...latest, content, status: 'complete', error: null }
        handlers.onComplete?.(latest)
        await conversationRepository.touch(conversationId)
        return latest
      }
    }

    const saved = await persistAssistantDelta(assistantId, content, 'complete')
    latest = saved ?? { ...latest, content, status: 'complete' }
    handlers.onComplete?.(latest)
    await conversationRepository.touch(conversationId)
    return latest
  } catch (e) {
    const err = e instanceof Error ? e.message : 'تعذر توليد الرد'
    const status = handlers.signal.aborted ? 'cancelled' : 'error'
    const saved = await persistAssistantDelta(assistantId, content, status, err)
    latest = saved ?? { ...latest, status, error: err, content }
    handlers.onError?.(latest, err)
    return latest
  }
}

export const chatService = {
  async listConversations(limit = 50): Promise<ChatConversation[]> {
    const rows = await conversationRepository.listByUser(limit)
    return rows.map(conversationFromRow)
  },

  async createConversation(title?: string): Promise<ChatConversation> {
    if (title) {
      const err = validateConversationTitle(title)
      if (err) throw new Error(err)
    }
    const row = await conversationRepository.create({
      title: title?.trim() || 'محادثة جديدة',
      modality_default: 'text',
    })
    if (!row) throw new Error('تعذر إنشاء المحادثة')
    return conversationFromRow(row)
  },

  async renameConversation(id: string, title: string): Promise<ChatConversation> {
    const err = validateConversationTitle(title)
    if (err) throw new Error(err)
    const row = await conversationRepository.update(id, { title: title.trim() })
    if (!row) throw new Error('تعذر إعادة تسمية المحادثة')
    return conversationFromRow(row)
  },

  async deleteConversation(id: string): Promise<void> {
    await conversationRepository.delete(id)
  },

  async getConversationDetail(id: string): Promise<ConversationDetail> {
    const conversation = await conversationRepository.getById(id)
    if (!conversation) throw new Error('المحادثة غير موجودة')
    const messages = await messageRepository.listByConversation(id)
    return {
      conversation: conversationFromRow(conversation),
      messages: messages.map(messageFromRow),
    }
  },

  async sendUserMessage(
    conversationId: string,
    content: string,
    handlers: StreamHandlers,
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }> {
    const validation = validateUserMessage(content)
    if (validation) throw new Error(validation)

    const existing = await messageRepository.listByConversation(conversationId)
    const userRow = await messageRepository.create({
      conversation_id: conversationId,
      role: 'user',
      modality: 'text',
      content: content.trim(),
      status: 'complete',
    })
    if (!userRow) throw new Error('تعذر حفظ الرسالة')

    if (existing.length === 0) {
      const autoTitle = titleFromFirstMessage(content)
      await conversationRepository.update(conversationId, { title: autoTitle })
    } else {
      await conversationRepository.touch(conversationId)
    }

    const assistantRow = await messageRepository.create({
      conversation_id: conversationId,
      role: 'assistant',
      modality: 'text',
      content: '',
      status: 'streaming',
      provider_meta: { providerId: activeProvider.providerId },
    })
    if (!assistantRow) throw new Error('تعذر بدء رد المساعد')

    const user = messageFromRow(userRow)
    const assistantSeed = messageFromRow(assistantRow)
    handlers.onAssistantCreate?.(assistantSeed)

    const history = [...existing.map(messageFromRow), user]
    const assistant = await streamIntoAssistant(conversationId, history, assistantSeed.id, handlers)
    return { user, assistant }
  },

  async retryAssistantMessage(
    conversationId: string,
    assistantMessageId: string,
    handlers: StreamHandlers,
  ): Promise<ChatMessage> {
    const messages = (await messageRepository.listByConversation(conversationId)).map(messageFromRow)
    const target = findRetryTarget(messages, assistantMessageId)
    if (!target) throw new Error('تعذر العثور على الرسالة لإعادة المحاولة')

    await messageRepository.update(assistantMessageId, {
      content: '',
      status: 'streaming',
      error: null,
      provider_meta: { providerId: activeProvider.providerId },
    })

    const seed: ChatMessage = {
      ...target.assistant,
      content: '',
      status: 'streaming',
      error: null,
      providerMeta: { providerId: activeProvider.providerId },
    }
    handlers.onAssistantCreate?.(seed)

    // History up to and including the paired user message
    const truncated: ChatMessage[] = []
    for (const message of messages) {
      if (message.id === assistantMessageId) break
      truncated.push(message)
    }

    return streamIntoAssistant(conversationId, truncated, assistantMessageId, handlers)
  },
}
