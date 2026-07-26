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

  it('hands-free waits for silence timeout before sending (tolerates short pauses)', async () => {
    vi.useFakeTimers()
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
      silenceTimeoutMs: 2500,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
    })

    await session.startHandsFree('c1')
    controller.emitFinal('hi there')
    await Promise.resolve()
    expect(sendTurn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2490)
    expect(sendTurn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20)
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'hi there', modality: 'audio' }),
      expect.any(Object),
    )
    session.dispose()
    vi.useRealTimers()
  })

  it('cancelInFlight while processing resumes continuous listening', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const deferred: { reject: ((error: Error) => void) | null } = { reject: null }
    const sendTurn = vi.fn(() => new Promise((_resolve, reject) => {
      deferred.reject = reject
    }))

    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2500,
      readyHoldMs: 0,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    await session.startHandsFree('c1')
    controller.emitFinal('متابعة الرحلة', 0.9)
    await vi.advanceTimersByTimeAsync(2600)
    expect(sendTurn).toHaveBeenCalled()
    expect(session.getStatus()).toBe('processing')

    // Barge-in is ignored without real TTS audio; cancelInFlight handles processing.
    expect(session.interrupt()).toBe(false)
    session.cancelInFlight()
    deferred.reject?.(new Error('aborted'))
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    expect(statuses).toContain('reconnecting')
    expect(['listening', 'reconnecting', 'ready']).toContain(session.getStatus())
    session.dispose()
    vi.useRealTimers()
  })

  it('interrupt is ignored when no assistant audio is playing', () => {
    const { provider: stt } = createMockSpeechToTextProvider('hello')
    const tts = createMockTextToSpeechProvider()
    const abortStream = vi.fn()
    const session = createVoiceSession({ stt, tts })
    expect(session.interrupt(abortStream)).toBe(false)
    expect(abortStream).not.toHaveBeenCalled()
    session.dispose()
  })

  it('ignores aborted STT errors and clears handlers on dispose', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider()
    const onError = vi.fn()
    const session = createVoiceSession({
      stt,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'granted', error: null }),
      callbacks: { onError },
    })
    await session.startPushToTalk()
    controller.emitError('aborted')
    expect(onError).not.toHaveBeenCalled()
    session.dispose()
    expect(stt.onPartial).toBeUndefined()
    expect(stt.onEnd).toBeUndefined()
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

  it('speaks meta.spokenText instead of full itinerary markdown', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('خطة')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const assistant = {
        ...assistantMessage('## Huge plan\n\n### Daily itinerary\n- day 1\n- day 2'),
        providerMeta: {
          spokenText: 'I have a first cut for Japan — five days for a couple.',
          voicePhase: 'final',
        },
      }
      await handlers.onComplete?.(assistant)
      return {
        user: {
          ...assistant,
          id: 'u1',
          role: 'user' as const,
          modality: 'audio' as const,
          content: 'خطة',
        },
        assistant,
      }
    })

    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      locale: 'en',
    })

    await session.startPushToTalk()
    await session.stopPushToTalkAndSend('c1')
    expect(tts.spoken.some((t) => t.includes('first cut for Japan'))).toBe(true)
    expect(tts.spoken.every((t) => !t.includes('Daily itinerary'))).toBe(true)
    session.dispose()
  })
})
