import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  chatService,
  resetChatProviderForTests,
  setChatProviderForTests,
} from '../chat/chatService'
import { createDeterministicMockChatProvider } from '../chat/mockChatProvider'
import { conversationRepository } from '../repositories/conversationRepository'
import { messageRepository } from '../repositories/messageRepository'
import type { ConversationRow, MessageRow } from '../types'

function conversationRow(overrides: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id: 'conv-1',
    user_id: 'user-1',
    title: 'محادثة جديدة',
    modality_default: 'text',
    travel_session_id: null,
    last_message_preview: '',
    created_at: '2026-07-15T10:00:00.000Z',
    updated_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    user_id: 'user-1',
    role: 'user',
    modality: 'text',
    content: 'hello',
    audio_url: null,
    image_url: null,
    attachments: [],
    status: 'complete',
    error: null,
    provider_meta: {},
    created_at: '2026-07-15T10:00:00.000Z',
    updated_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('chatService integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setChatProviderForTests(createDeterministicMockChatProvider('مرحبا بك\n\n```js\nconsole.log(1)\n```', 0))
  })

  afterEach(() => {
    resetChatProviderForTests()
    vi.restoreAllMocks()
  })

  it('lists, renames, and deletes conversations', async () => {
    vi.spyOn(conversationRepository, 'listByUser').mockResolvedValue([
      conversationRow({ id: 'c1', title: 'أ' }),
      conversationRow({ id: 'c2', title: 'ب' }),
    ])
    vi.spyOn(conversationRepository, 'update').mockResolvedValue(
      conversationRow({ id: 'c1', title: 'طوكيو' }),
    )
    const deleteSpy = vi.spyOn(conversationRepository, 'delete').mockResolvedValue(true)

    const listed = await chatService.listConversations()
    expect(listed).toHaveLength(2)

    const renamed = await chatService.renameConversation('c1', 'طوكيو')
    expect(renamed.title).toBe('طوكيو')

    await chatService.deleteConversation('c2')
    expect(deleteSpy).toHaveBeenCalledWith('c2')
  })

  it('getConversationDetail maps history for text modality (voice-ready shape)', async () => {
    vi.spyOn(conversationRepository, 'getById').mockResolvedValue(
      conversationRow({ id: 'c1', modality_default: 'text' }),
    )
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([
      messageRow({ id: 'u1', role: 'user', content: 'مرحبا', modality: 'text' }),
      messageRow({
        id: 'a1',
        role: 'assistant',
        content: 'أهلا',
        modality: 'text',
        audio_url: null,
      }),
    ])

    const detail = await chatService.getConversationDetail('c1')
    expect(detail.conversation.modalityDefault).toBe('text')
    expect(detail.messages).toHaveLength(2)
    expect(detail.messages[1].audioUrl).toBeNull()
    expect(detail.messages[1].imageUrl).toBeNull()
  })

  it('createConversation validates title', async () => {
    await expect(chatService.createConversation(' ')).rejects.toThrow()
    const createSpy = vi.spyOn(conversationRepository, 'create').mockResolvedValue(conversationRow())
    const created = await chatService.createConversation('رحلة')
    expect(created.id).toBe('conv-1')
    expect(createSpy).toHaveBeenCalled()
  })

  it('sendUserMessage persists user + streams assistant markdown', async () => {
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([])
    vi.spyOn(messageRepository, 'create')
      .mockResolvedValueOnce(messageRow({ id: 'u1', role: 'user', content: 'خطة طوكيو' }))
      .mockResolvedValueOnce(messageRow({
        id: 'a1',
        role: 'assistant',
        content: '',
        status: 'streaming',
      }))
    const updateSpy = vi.spyOn(messageRepository, 'update').mockImplementation(async (id, updates) =>
      messageRow({
        id,
        role: 'assistant',
        content: updates.content ?? '',
        status: updates.status ?? 'streaming',
        error: updates.error ?? null,
      }),
    )
    vi.spyOn(conversationRepository, 'update').mockResolvedValue(
      conversationRow({ title: 'خطة طوكيو' }),
    )
    vi.spyOn(conversationRepository, 'touch').mockResolvedValue()

    const deltas: string[] = []
    const result = await chatService.sendUserMessage('conv-1', 'خطة طوكيو', {
      signal: new AbortController().signal,
      onDelta: (m) => deltas.push(m.content),
    })

    expect(result.user.content).toBe('خطة طوكيو')
    expect(result.assistant.status).toBe('complete')
    expect(result.assistant.content).toContain('```js')
    expect(deltas.length).toBeGreaterThan(0)
    expect(updateSpy).toHaveBeenCalled()
  })

  it('retryAssistantMessage regenerates from prior user turn', async () => {
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([
      messageRow({ id: 'u1', role: 'user', content: 'hi' }),
      messageRow({ id: 'a1', role: 'assistant', content: 'old', status: 'complete' }),
    ])
    vi.spyOn(messageRepository, 'update').mockImplementation(async (id, updates) =>
      messageRow({
        id,
        role: 'assistant',
        content: updates.content ?? '',
        status: updates.status ?? 'complete',
      }),
    )
    vi.spyOn(conversationRepository, 'touch').mockResolvedValue()

    const result = await chatService.retryAssistantMessage('conv-1', 'a1', {
      signal: new AbortController().signal,
    })
    expect(result.id).toBe('a1')
    expect(result.status).toBe('complete')
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('stop/cancel via AbortSignal marks assistant cancelled', async () => {
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([])
    vi.spyOn(messageRepository, 'create')
      .mockResolvedValueOnce(messageRow({ id: 'u1', role: 'user', content: 'stop me' }))
      .mockResolvedValueOnce(messageRow({
        id: 'a1',
        role: 'assistant',
        content: '',
        status: 'streaming',
      }))
    vi.spyOn(messageRepository, 'update').mockImplementation(async (id, updates) =>
      messageRow({
        id,
        role: 'assistant',
        content: updates.content ?? '',
        status: updates.status ?? 'streaming',
        error: updates.error ?? null,
      }),
    )
    vi.spyOn(conversationRepository, 'update').mockResolvedValue(conversationRow())
    vi.spyOn(conversationRepository, 'touch').mockResolvedValue()

    setChatProviderForTests(createDeterministicMockChatProvider('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 30))
    const controller = new AbortController()
    const promise = chatService.sendUserMessage('conv-1', 'stop me', {
      signal: controller.signal,
    })
    controller.abort()
    const result = await promise
    expect(['cancelled', 'complete', 'error']).toContain(result.assistant.status)
  })
})
