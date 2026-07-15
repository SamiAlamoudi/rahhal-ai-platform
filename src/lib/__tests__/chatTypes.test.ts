import { describe, it, expect } from 'vitest'
import { conversationFromRow, messageFromRow } from '../chat/chatTypes'
import type { ConversationRow, MessageRow } from '../types'

describe('chatTypes mappers', () => {
  it('maps conversation rows preserving voice-ready modality and preview fields', () => {
    const row: ConversationRow = {
      id: 'c1',
      user_id: 'u1',
      title: 'رحلة',
      modality_default: 'audio',
      travel_session_id: 's1',
      last_message_preview: 'مرحبا',
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    }
    const mapped = conversationFromRow(row)
    expect(mapped.modalityDefault).toBe('audio')
    expect(mapped.travelSessionId).toBe('s1')
    expect(mapped.lastMessagePreview).toBe('مرحبا')
  })

  it('maps message rows with streaming status, audio url, and attachment fields', () => {
    const row: MessageRow = {
      id: 'm1',
      conversation_id: 'c1',
      user_id: 'u1',
      role: 'assistant',
      modality: 'audio',
      content: '',
      audio_url: 'https://example.com/a.webm',
      image_url: null,
      attachments: [],
      status: 'streaming',
      error: null,
      provider_meta: { providerId: 'mock' },
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    }
    const mapped = messageFromRow(row)
    expect(mapped.modality).toBe('audio')
    expect(mapped.audioUrl).toBe('https://example.com/a.webm')
    expect(mapped.imageUrl).toBeNull()
    expect(mapped.attachments).toEqual([])
    expect(mapped.status).toBe('streaming')
  })
})
