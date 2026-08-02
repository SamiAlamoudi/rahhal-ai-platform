import { describe, it, expect, beforeEach } from 'vitest'
import { chatEngine } from '../chat/chatEngine'
import { resetProductBrainController } from '../../brain-ui/productBrain'

describe('chatEngine TravelBrain adapter', () => {
  beforeEach(() => {
    resetProductBrainController()
  })

  it('searches conversations and supports modalities', () => {
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

  it('sendMessage routes to TravelBrain (not planTurn)', async () => {
    const result = await chatEngine.sendMessage(
      {
        conversationId: 'conv-1',
        content: 'Book a flight from Riyadh to Istanbul budget 5000 SAR',
        modality: 'audio',
        audioUrl: 'https://example.com/a.webm',
      },
      { signal: new AbortController().signal },
    )

    expect(result.user.modality).toBe('audio')
    expect(result.user.audioUrl).toBe('https://example.com/a.webm')
    expect(result.assistant.status).toBe('complete')
    expect(result.assistant.content.length).toBeGreaterThan(0)
    expect(result.assistant.providerMeta.engine).toBe('TravelBrain')
  })

  it('list/create use in-memory TravelBrain session summaries', async () => {
    await chatEngine.sendMessage(
      { conversationId: 'c', content: 'Recommend a hotel in Dubai' },
      { signal: new AbortController().signal },
    )
    const listed = await chatEngine.listConversations()
    expect(Array.isArray(listed)).toBe(true)
    const created = await chatEngine.createConversation('جديدة')
    expect(created.title).toBe('جديدة')
  })
})
