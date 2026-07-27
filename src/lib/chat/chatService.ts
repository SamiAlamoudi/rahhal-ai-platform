import { conversationRepository } from '../repositories/conversationRepository'
import { messageRepository } from '../repositories/messageRepository'
import { createChatProvider } from './chatProviderFactory'
import type { ChatAttachment } from './chatAttachments'
import type { ChatModality, ChatProvider } from './chatTypes'
import {
  conversationFromRow,
  messageFromRow,
  type ChatConversation,
  type ChatMessage,
} from './chatTypes'
import {
  buildMessagePreview,
  filterConversations,
  findRetryTarget,
  titleFromFirstMessage,
  validateConversationTitle,
  validateUserMessage,
} from './chatHelpers'
import { assertChatDatabaseAuth } from './chatAuthGate'
import { diagnosePipelineError, logPipeline } from './pipelineDiagnostics'
import { AppError } from '../ops/errors/canonicalError'
import { isLocalChatAuthError, localChatStore } from './localChatStore'

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

export interface SendUserMessageOptions {
  modality?: ChatModality
  audioUrl?: string | null
  imageUrl?: string | null
  attachments?: ChatAttachment[]
}

let activeProvider: ChatProvider = createChatProvider()

export function setChatProviderForTests(provider: ChatProvider): void {
  activeProvider = provider
}

export function resetChatProviderForTests(): void {
  activeProvider = createChatProvider()
}

function isLocalConversationId(id: string): boolean {
  return id.startsWith('lconv_')
}

function isLocalMessageId(id: string): boolean {
  return id.startsWith('lmsg_')
}

async function persistAssistantDelta(
  conversationId: string,
  messageId: string,
  content: string,
  status: string,
  error: string | null = null,
  providerMeta: Record<string, unknown> = {},
): Promise<ChatMessage | null> {
  if (isLocalMessageId(messageId) || isLocalConversationId(conversationId)) {
    return localChatStore.updateMessage(conversationId, messageId, {
      content,
      status: status as ChatMessage['status'],
      error,
      providerMeta: {
        providerId: activeProvider.providerId,
        ...providerMeta,
      },
    })
  }
  const row = await messageRepository.update(messageId, {
    content,
    status,
    error,
    provider_meta: {
      providerId: activeProvider.providerId,
      ...providerMeta,
    },
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
  let streamMeta: Record<string, unknown> = {}
  let latest: ChatMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    modality: 'text',
    content: '',
    audioUrl: null,
    imageUrl: null,
    attachments: [],
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
      if (chunk.type === 'delta') {
        if (chunk.text) content += chunk.text
        const experienceState =
          chunk.experienceState
          ?? (typeof chunk.meta?.experienceState === 'string' ? chunk.meta.experienceState : null)
        if (experienceState) {
          streamMeta = { ...streamMeta, experienceState, chatgptExperience: true }
        }
        if (chunk.meta) {
          streamMeta = { ...streamMeta, ...chunk.meta }
        }
        // Skip empty status-only deltas for content, but still notify UI for state / early voice.
        const spokenReady = typeof chunk.meta?.spokenText === 'string' && chunk.meta.spokenText.trim().length > 0
        if (chunk.text || experienceState || spokenReady) {
          latest = {
            ...latest,
            content,
            status: 'streaming',
            providerMeta: {
              providerId: activeProvider.providerId,
              ...streamMeta,
            },
            updatedAt: new Date().toISOString(),
          }
          handlers.onDelta?.(latest)
        }
        // Non-blocking mid-stream persist so network lag does not stall UI deltas
        if (chunk.text && content.length - lastPersistedLength >= 120) {
          lastPersistedLength = content.length
          const snapshot = content
          void persistAssistantDelta(conversationId, assistantId, snapshot, 'streaming', null, streamMeta).catch((err) => {
            logPipeline({
              stage: 'database',
              event: 'mid_stream_persist_failed',
              error: err,
              message: err instanceof Error ? err.message : String(err),
            })
          })
        }
      } else if (chunk.type === 'error') {
        const err = chunk.error === 'cancelled' ? 'cancelled' : (chunk.error ?? 'stream error')
        const status = err === 'cancelled' ? 'cancelled' : 'error'
        const saved = await persistAssistantDelta(conversationId, assistantId, content, status, err, streamMeta)
        latest = saved ?? { ...latest, status, error: err, content }
        handlers.onError?.(latest, err)
        return latest
      } else if (chunk.type === 'done') {
        if (chunk.meta) streamMeta = chunk.meta
        const saved = await persistAssistantDelta(conversationId, assistantId, content, 'complete', null, streamMeta)
        latest = saved ?? {
          ...latest,
          content,
          status: 'complete',
          error: null,
          providerMeta: { providerId: activeProvider.providerId, ...streamMeta },
        }
        await Promise.resolve(handlers.onComplete?.(latest))
        await touchConversation(conversationId, buildMessagePreview(content))
        return latest
      }
    }

    const saved = await persistAssistantDelta(conversationId, assistantId, content, 'complete', null, streamMeta)
    latest = saved ?? {
      ...latest,
      content,
      status: 'complete',
      providerMeta: { providerId: activeProvider.providerId, ...streamMeta },
    }
    await Promise.resolve(handlers.onComplete?.(latest))
    await touchConversation(conversationId, buildMessagePreview(content))
    return latest
  } catch (e) {
    const err = e instanceof Error ? e.message : 'تعذر توليد الرد'
    const status = handlers.signal.aborted ? 'cancelled' : 'error'
    const saved = await persistAssistantDelta(conversationId, assistantId, content, status, err, streamMeta)
    latest = saved ?? { ...latest, status, error: err, content }
    handlers.onError?.(latest, err)
    return latest
  }
}

async function touchConversation(conversationId: string, preview: string): Promise<void> {
  if (isLocalConversationId(conversationId)) {
    localChatStore.touchConversation(conversationId, preview)
    return
  }
  await conversationRepository.touch(conversationId, preview)
}

export const chatService = {
  async listConversations(limit = 50): Promise<ChatConversation[]> {
    try {
      await assertChatDatabaseAuth('listConversations')
      const rows = await conversationRepository.listByUser(limit)
      logPipeline({
        stage: 'conversation',
        event: 'list_ok',
        meta: { count: rows.length },
      })
      const remote = rows.map(conversationFromRow)
      const local = localChatStore.listConversations(limit)
      const byId = new Map<string, ChatConversation>()
      for (const row of [...local, ...remote]) byId.set(row.id, row)
      return [...byId.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
    } catch (error) {
      if (isLocalChatAuthError(error)) {
        logPipeline({ stage: 'conversation', event: 'list_local_fallback' })
        return localChatStore.listConversations(limit)
      }
      throw diagnosePipelineError('conversation', 'listConversations', error)
    }
  },

  searchConversations(conversations: ChatConversation[], query: string): ChatConversation[] {
    return filterConversations(conversations, query)
  },

  async createConversation(title?: string): Promise<ChatConversation> {
    if (title) {
      const err = validateConversationTitle(title)
      if (err) throw new Error(err)
    }
    try {
      await assertChatDatabaseAuth('createConversation')
      const row = await conversationRepository.create({
        title: title?.trim() || 'محادثة جديدة',
        modality_default: 'text',
      })
      if (!row) {
        throw new AppError({
          code: 'forbidden',
          message: 'Conversation insert returned null (likely RLS SELECT mismatch)',
          userMessage: 'تعذر إنشاء المحادثة. تحقق من تسجيل الدخول وصلاحيات قاعدة البيانات.',
          domain: 'chat.database',
          operation: 'createConversation',
          status: 403,
        })
      }
      logPipeline({
        stage: 'conversation',
        event: 'create_ok',
        meta: { id: row.id },
      })
      return conversationFromRow(row)
    } catch (error) {
      if (isLocalChatAuthError(error) || (error as { code?: string })?.code === 'forbidden') {
        logPipeline({ stage: 'conversation', event: 'create_local_fallback' })
        return localChatStore.createConversation(title)
      }
      throw diagnosePipelineError('conversation', 'createConversation', error)
    }
  },

  async renameConversation(id: string, title: string): Promise<ChatConversation> {
    const err = validateConversationTitle(title)
    if (err) throw new Error(err)
    if (isLocalConversationId(id)) return localChatStore.renameConversation(id, title)
    try {
      await assertChatDatabaseAuth('renameConversation')
      const row = await conversationRepository.update(id, { title: title.trim() })
      if (!row) throw new Error('تعذر إعادة تسمية المحادثة')
      return conversationFromRow(row)
    } catch (error) {
      throw diagnosePipelineError('conversation', 'renameConversation', error)
    }
  },

  async deleteConversation(id: string): Promise<void> {
    if (isLocalConversationId(id)) {
      localChatStore.deleteConversation(id)
      return
    }
    try {
      await assertChatDatabaseAuth('deleteConversation')
      await conversationRepository.delete(id)
    } catch (error) {
      throw diagnosePipelineError('conversation', 'deleteConversation', error)
    }
  },

  async getConversationDetail(id: string): Promise<ConversationDetail> {
    if (isLocalConversationId(id)) return localChatStore.getConversationDetail(id)
    try {
      await assertChatDatabaseAuth('getConversationDetail')
      const conversation = await conversationRepository.getById(id)
      if (!conversation) {
        throw new AppError({
          code: 'not_found',
          message: `Conversation not found: ${id}`,
          userMessage: 'المحادثة غير موجودة أو لم يعد بإمكانك الوصول إليها.',
          domain: 'chat.database',
          operation: 'getConversationDetail',
          status: 404,
        })
      }
      const messages = await messageRepository.listByConversation(id)
      logPipeline({
        stage: 'conversation',
        event: 'detail_ok',
        meta: { id, messages: messages.length },
      })
      return {
        conversation: conversationFromRow(conversation),
        messages: messages.map(messageFromRow),
      }
    } catch (error) {
      if (isLocalChatAuthError(error)) return localChatStore.getConversationDetail(id)
      throw diagnosePipelineError('conversation', 'getConversationDetail', error)
    }
  },

  async sendUserMessage(
    conversationId: string,
    content: string,
    handlers: StreamHandlers,
    options: SendUserMessageOptions = {},
  ): Promise<{ user: ChatMessage; assistant: ChatMessage }> {
    const validation = validateUserMessage(content)
    if (validation) throw new Error(validation)

    if (isLocalConversationId(conversationId)) {
      return sendLocalUserMessage(conversationId, content, handlers, options)
    }

    try {
      await assertChatDatabaseAuth('sendUserMessage')
      const modality: ChatModality = options.modality === 'audio' ? 'audio' : 'text'
      const attachments = options.attachments ?? []

      const existing = await messageRepository.listByConversation(conversationId)
      const userRow = await messageRepository.create({
        conversation_id: conversationId,
        role: 'user',
        modality,
        content: content.trim(),
        audio_url: options.audioUrl ?? null,
        image_url: options.imageUrl ?? null,
        attachments,
        status: 'complete',
      })
      if (!userRow) throw new Error('تعذر حفظ الرسالة')

      const preview = buildMessagePreview(content)
      if (existing.length === 0) {
        const autoTitle = titleFromFirstMessage(content)
        await conversationRepository.update(conversationId, {
          title: autoTitle,
          last_message_preview: preview,
        })
      } else {
        await conversationRepository.touch(conversationId, preview)
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
      logPipeline({
        stage: 'ai',
        event: 'stream_started',
        meta: { conversationId, history: history.length },
      })
      const assistant = await streamIntoAssistant(conversationId, history, assistantSeed.id, handlers)
      return { user, assistant }
    } catch (error) {
      if (isLocalChatAuthError(error)) {
        const local = localChatStore.createConversation(titleFromFirstMessage(content))
        return sendLocalUserMessage(local.id, content, handlers, options)
      }
      throw diagnosePipelineError('conversation', 'sendUserMessage', error)
    }
  },

  async retryAssistantMessage(
    conversationId: string,
    assistantMessageId: string,
    handlers: StreamHandlers,
  ): Promise<ChatMessage> {
    if (isLocalConversationId(conversationId)) {
      const detail = localChatStore.getConversationDetail(conversationId)
      const target = findRetryTarget(detail.messages, assistantMessageId)
      if (!target) throw new Error('تعذر العثور على الرسالة لإعادة المحاولة')
      localChatStore.updateMessage(conversationId, assistantMessageId, {
        content: '',
        status: 'streaming',
        error: null,
        providerMeta: { providerId: activeProvider.providerId },
      })
      const seed: ChatMessage = {
        ...target.assistant,
        content: '',
        status: 'streaming',
        error: null,
        providerMeta: { providerId: activeProvider.providerId },
      }
      handlers.onAssistantCreate?.(seed)
      const truncated: ChatMessage[] = []
      for (const message of detail.messages) {
        if (message.id === assistantMessageId) break
        truncated.push(message)
      }
      return streamIntoAssistant(conversationId, truncated, assistantMessageId, handlers)
    }
    try {
      await assertChatDatabaseAuth('retryAssistantMessage')
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

      const truncated: ChatMessage[] = []
      for (const message of messages) {
        if (message.id === assistantMessageId) break
        truncated.push(message)
      }

      return await streamIntoAssistant(conversationId, truncated, assistantMessageId, handlers)
    } catch (error) {
      throw diagnosePipelineError('conversation', 'retryAssistantMessage', error)
    }
  },
}

async function sendLocalUserMessage(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
  options: SendUserMessageOptions,
): Promise<{ user: ChatMessage; assistant: ChatMessage }> {
  const modality: ChatModality = options.modality === 'audio' ? 'audio' : 'text'
  const detail = localChatStore.getConversationDetail(conversationId)
  const user = localChatStore.appendMessage({
    conversationId,
    role: 'user',
    content: content.trim(),
    modality,
    status: 'complete',
  })
  if (detail.messages.length === 0) {
    localChatStore.renameConversation(conversationId, titleFromFirstMessage(content))
  }
  localChatStore.touchConversation(conversationId, buildMessagePreview(content))
  const assistantSeed = localChatStore.appendMessage({
    conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming',
    providerMeta: { providerId: activeProvider.providerId },
  })
  handlers.onAssistantCreate?.(assistantSeed)
  const history = [...detail.messages, user]
  logPipeline({
    stage: 'ai',
    event: 'stream_started_local',
    meta: { conversationId, history: history.length },
  })
  const assistant = await streamIntoAssistant(conversationId, history, assistantSeed.id, handlers)
  return { user, assistant }
}
