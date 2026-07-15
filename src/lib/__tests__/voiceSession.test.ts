import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createVoiceSession, stripMarkdownForSpeech } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import type { ChatMessage } from '../chat/chatTypes'

function assistantMessage(content: string): ChatMessage {
  return {
    id: 'a1',
    conversationId: 'c1',
    role: 'assistant',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('voiceSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stripMarkdownForSpeech removes fences and emphasis markers', () => {
    const spoken = stripMarkdownForSpeech('## Hello\n\n**world** and `code`\n```js\nx\n```')
    expect(spoken).toContain('Hello')
    expect(spoken).toContain('world')
    expect(spoken).not.toContain('```')
  })

  it('push-to-talk sends audio modality through shared chat engine', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('رحلة إلى باريس')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const assistant = assistantMessage('خطة قصيرة لباريس')
      await handlers.onComplete?.(assistant)
      return {
        user: {
          ...assistant,
          id: 'u1',
          role: 'user' as const,
          modality: 'audio' as const,
          content: 'رحلة إلى باريس',
        },
        assistant,
      }
    })

    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      locale: 'ar',
    })

    await session.startPushToTalk()
    expect(session.getStatus()).toBe('listening')
    const assistant = await session.stopPushToTalkAndSend('c1')

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'c1',
        content: 'رحلة إلى باريس',
        modality: 'audio',
      }),
      expect.any(Object),
    )
    expect(assistant?.content).toContain('باريس')
    expect(tts.spoken.some((t) => t.includes('باريس'))).toBe(true)
    session.dispose()
  })

  it('hands-free final transcript triggers sendTurn', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const assistant = assistantMessage('ok')
      await handlers.onComplete?.(assistant)
      return {
        user: { ...assistant, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'hi' },
        assistant,
      }
    })

    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      mode: 'hands_free',
    })

    await session.startHandsFree('c1')
    controller.emitFinal('hi there')
    // allow async sendTranscript
    await new Promise((r) => setTimeout(r, 0))
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'hi there', modality: 'audio' }),
      expect.any(Object),
    )
    session.dispose()
  })

  it('interrupt stops TTS and aborts stream', () => {
    const { provider: stt } = createMockSpeechToTextProvider('hello')
    const tts = createMockTextToSpeechProvider()
    const abortStream = vi.fn()
    const session = createVoiceSession({ stt, tts })
    session.interrupt(abortStream)
    expect(abortStream).toHaveBeenCalled()
    expect(session.getStatus()).toBe('idle')
    session.dispose()
  })

  it('supports ar/en locales and denied mic permission', async () => {
    const { provider: stt } = createMockSpeechToTextProvider()
    const tts = createMockTextToSpeechProvider()
    const session = createVoiceSession({
      stt,
      tts,
      locale: 'en',
      requestPermission: async () => ({ state: 'denied', error: 'blocked' }),
    })
    expect(session.getLocale()).toBe('en')
    session.setLocale('ar')
    expect(session.getLocale()).toBe('ar')
    const permission = await session.ensureMicPermission()
    expect(permission.state).toBe('denied')
    expect(session.getStatus()).toBe('error')
    session.dispose()
  })
})
