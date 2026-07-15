import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chatEngine } from '../chat/chatEngine'
import { chatService, resetChatProviderForTests, setChatProviderForTests } from '../chat/chatService'
import { createDeterministicMockChatProvider } from '../chat/mockChatProvider'
import { conversationRepository } from '../repositories/conversationRepository'
import { messageRepository } from '../repositories/messageRepository'
import type { ConversationRow, MessageRow } from '../types'

function conversationRow(overrides: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id: 'conv-1',
    user_id: 'user-1',
    title: 'محادثة',
    modality_default: 'text',
    travel_session_id: null,
    last_message_preview: 'آخر رسالة',
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

describe('chatEngine shared text/voice entrypoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setChatProviderForTests(createDeterministicMockChatProvider('voice-ready-reply', 0))
  })

  afterEach(() => {
    resetChatProviderForTests()
    vi.restoreAllMocks()
  })

  it('searches conversations via shared engine', async () => {
    const listed = [
      {
        id: '1',
        title: 'طوكيو',
        modalityDefault: 'text' as const,
        travelSessionId: null,
        lastMessagePreview: 'فندق وسط المدينة',
        createdAt: '2026-07-15T00:00:00.000Z',
        updatedAt: '2026-07-15T00:00:00.000Z',
      },
    ]
    expect(chatEngine.searchConversations(listed, 'فندق')).toHaveLength(1)
    expect(chatEngine.supportsModality('audio')).toBe(true)
  })

  it('sendMessage supports audio modality options for future Voice', async () => {
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([])
    const createSpy = vi.spyOn(messageRepository, 'create')
      .mockResolvedValueOnce(messageRow({
        id: 'u1',
        role: 'user',
        modality: 'audio',
        content: 'أريد رحلة صوتية',
        audio_url: 'https://example.com/a.webm',
      }))
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
        status: updates.status ?? 'complete',
      }),
    )
    vi.spyOn(conversationRepository, 'update').mockResolvedValue(conversationRow())
    vi.spyOn(conversationRepository, 'touch').mockResolvedValue()

    const result = await chatEngine.sendMessage({
      conversationId: 'conv-1',
      content: 'أريد رحلة صوتية',
      modality: 'audio',
      audioUrl: 'https://example.com/a.webm',
    }, { signal: new AbortController().signal })

    expect(result.user.modality).toBe('audio')
    expect(result.user.audioUrl).toBe('https://example.com/a.webm')
    expect(result.assistant.status).toBe('complete')
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      modality: 'audio',
      audio_url: 'https://example.com/a.webm',
    }))
  })

  it('delegates list/create to chatService (same storage)', async () => {
    const listSpy = vi.spyOn(chatService, 'listConversations').mockResolvedValue([])
    const createSpy = vi.spyOn(chatService, 'createConversation').mockResolvedValue({
      id: 'c1',
      title: 'جديدة',
      modalityDefault: 'text',
      travelSessionId: null,
      lastMessagePreview: '',
      createdAt: '2026-07-15T00:00:00.000Z',
      updatedAt: '2026-07-15T00:00:00.000Z',
    })
    await chatEngine.listConversations()
    await chatEngine.createConversation('جديدة')
    expect(listSpy).toHaveBeenCalled()
    expect(createSpy).toHaveBeenCalledWith('جديدة')
  })
})
