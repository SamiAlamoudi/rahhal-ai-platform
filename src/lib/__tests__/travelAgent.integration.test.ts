import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  chatService,
  resetChatProviderForTests,
  setChatProviderForTests,
} from '../chat/chatService'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import { conversationRepository } from '../repositories/conversationRepository'
import { messageRepository } from '../repositories/messageRepository'
import type { ConversationRow, MessageRow } from '../types'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'

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

describe('travel agent + chatService integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setChatProviderForTests(createTravelAgentProvider())
  })

  afterEach(() => {
    resetChatProviderForTests()
    vi.restoreAllMocks()
  })

  it('streams itinerary and persists agent meta on the assistant message', async () => {
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([])
    vi.spyOn(messageRepository, 'create')
      .mockResolvedValueOnce(messageRow({
        id: 'u1',
        role: 'user',
        content: COMPLETE_JAPAN_7D,
      }))
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
        provider_meta: updates.provider_meta ?? {},
      }),
    )
    vi.spyOn(conversationRepository, 'update').mockResolvedValue(conversationRow({ title: 'Japan' }))
    vi.spyOn(conversationRepository, 'touch').mockResolvedValue()

    const result = await chatService.sendUserMessage(
      'conv-1',
      COMPLETE_JAPAN_7D,
      { signal: new AbortController().signal },
    )

    expect(result.assistant.status).toBe('complete')
    expect(result.assistant.content).toMatch(/Japan|اليابان|Day 1|Summary|الملخص/)
    expect(result.assistant.providerMeta.kind).toBe('travel_agent')
    expect(result.assistant.providerMeta.version).toBe(2)
    expect(result.assistant.providerMeta.tripPlan).toBeTruthy()
    expect(result.assistant.providerMeta.itinerary).toBeTruthy()
    expect(updateSpy).toHaveBeenCalled()
    const finalUpdate = updateSpy.mock.calls.find((call) => call[1]?.status === 'complete')
    expect(finalUpdate?.[1]?.provider_meta).toMatchObject({ kind: 'travel_agent', version: 2 })
  })
})
