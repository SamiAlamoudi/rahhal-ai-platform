/**
 * Recovery Phase 2.3 — continuous VoiceSessionManager tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createVoiceSessionManager } from '../chat/voice/voiceSessionManager'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import type { ChatMessage } from '../chat/chatTypes'
import type { TextToSpeechProvider } from '../chat/voice/voiceTypes'
import { VOICE_UX_LABELS_AR } from '../chat/voice/voiceTypes'

function assistantMessage(content: string, spokenText?: string): ChatMessage {
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
    providerMeta: spokenText ? { spokenText, voicePhase: 'final' } : {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

function createSendTurn(content = 'مرحباً بك') {
  return vi.fn(async (input: { content: string; modality: string }, handlers: {
    onComplete?: (m: ChatMessage) => void | Promise<void>
  }) => {
    const assistant = assistantMessage(content, content)
    await handlers.onComplete?.(assistant)
    return {
      user: {
        ...assistant,
        id: 'u1',
        role: 'user' as const,
        modality: 'audio' as const,
        content: input.content,
      },
      assistant,
    }
  })
}

const silentVad = {
  start: async () => {},
  stop: () => {},
  isSpeaking: () => false,
  getLevel: () => 0,
  isActive: () => false,
}

describe('Recovery Phase 2.3 — VoiceSessionManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('one tap starts the continuous session (listening)', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: silentVad,
    })
    expect(manager.getStatus()).toBe('idle')
    await manager.start('c1')
    expect(manager.isContinuousActive()).toBe(true)
    expect(manager.getStatus()).toBe('listening')
    expect(manager.getUxLabelAr()).toBe(VOICE_UX_LABELS_AR.listening)
    manager.dispose()
  })

  it('recognized speech auto-submits once through the shared chat pipeline', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const sendTurn = createSendTurn('خطة قصيرة')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    controller.emitFinal('أريد رحلة إلى باريس', 0.92)
    await vi.advanceTimersByTimeAsync(2300)

    expect(sendTurn).toHaveBeenCalledTimes(1)
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'c1',
        content: expect.stringContaining('باريس'),
        modality: 'audio',
      }),
      expect.any(Object),
    )
    manager.dispose()
  })

  it('assistant completion returns to listening in continuous mode', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const statuses: string[] = []
    const sendTurn = createSendTurn('تمام')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 100,
      activityMonitor: silentVad,
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    await manager.start('c1')
    controller.emitFinal('مرحبا', 0.9)
    await vi.advanceTimersByTimeAsync(2300)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(150)
    await Promise.resolve()

    expect(statuses).toContain('processing')
    expect(statuses).toContain('ready')
    expect(statuses).toContain('listening')
    expect(manager.isContinuousActive()).toBe(true)
    // Mock TTS must never surface "speaking"
    expect(statuses).not.toContain('speaking')
    manager.dispose()
  })

  it('explicit stop prevents automatic restart', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const sendTurn = createSendTurn('ok')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    await manager.stop()
    expect(manager.getStatus()).toBe('ended')
    expect(manager.isContinuousActive()).toBe(false)
    expect(manager.getUxLabelAr()).toBe('انتهت الجلسة')

    controller.emitFinal('should not send', 0.95)
    await vi.advanceTimersByTimeAsync(5000)
    expect(sendTurn).not.toHaveBeenCalled()
    manager.dispose()
  })

  it('inactivity ends the session', async () => {
    vi.useFakeTimers()
    const { provider: stt } = createMockSpeechToTextProvider('')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'granted', error: null }),
      inactivityTimeoutMs: 8_000,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    expect(manager.getStatus()).toBe('listening')
    await vi.advanceTimersByTimeAsync(8_100)
    expect(manager.getStatus()).toBe('ended')
    expect(manager.isContinuousActive()).toBe(false)
    manager.dispose()
  })

  it('permission denial recovers to a stable error state', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const onError = vi.fn()
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'denied', error: 'تم رفض إذن الميكروفون' }),
      callbacks: { onError },
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    expect(manager.getStatus()).toBe('error')
    expect(manager.isContinuousActive()).toBe(false)
    expect(onError).toHaveBeenCalled()
    manager.dispose()
  })

  it('unsupported browser falls back to typing guidance', async () => {
    const stt = createMockSpeechToTextProvider('').provider
    stt.isSupported = () => false
    const onError = vi.fn()
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'granted', error: null }),
      callbacks: { onError },
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    expect(manager.getStatus()).toBe('error')
    expect(onError.mock.calls[0]?.[0]).toMatch(/الكتابة/)
    manager.dispose()
  })

  it('duplicate final transcripts are not submitted twice', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const sendTurn = createSendTurn('ok')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    controller.emitFinal('نفس الجملة', 0.95)
    await vi.advanceTimersByTimeAsync(2300)
    await Promise.resolve()

    // Resume listening and emit the same utterance again quickly.
    controller.emitFinal('نفس الجملة', 0.95)
    await vi.advanceTimersByTimeAsync(2300)
    await Promise.resolve()

    expect(sendTurn).toHaveBeenCalledTimes(1)
    manager.dispose()
  })

  it('component unmount disposes listeners and timers', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const sendTurn = createSendTurn('ok')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      inactivityTimeoutMs: 10_000,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    controller.emitFinal('نص', 0.9)
    manager.dispose()
    expect(stt.onPartial).toBeUndefined()
    expect(stt.onFinal).toBeUndefined()
    expect(stt.onEnd).toBeUndefined()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(sendTurn).not.toHaveBeenCalled()
  })

  it('Arabic transcript remains Arabic (no English translation)', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const sendTurn = createSendTurn('حسناً')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      locale: 'ar',
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    controller.emitFinal('أريد السفر إلى مراكش لمدة خمسة أيام', 0.93)
    await vi.advanceTimersByTimeAsync(2300)

    const sent = sendTurn.mock.calls[0]?.[0] as { content: string }
    expect(sent.content).toMatch(/[\u0600-\u06FF]/)
    expect(sent.content).toContain('مراكش')
    expect(sent.content).not.toMatch(/\b(I want|travel to)\b/i)
    manager.dispose()
  })

  it('text and voice use the same conversation pipeline (sendTurn / chatEngine)', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const sendTurn = createSendTurn('ok')
    const manager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
    })

    await manager.start('c1')
    controller.emitFinal('حجز فندق في دبي', 0.9)
    await vi.advanceTimersByTimeAsync(2300)

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'c1',
        modality: 'audio',
      }),
      expect.objectContaining({
        onComplete: expect.any(Function),
        onDelta: expect.any(Function),
      }),
    )
    manager.dispose()
  })

  it('Speaking appears only when real TTS audio is playing', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const mockStatuses: string[] = []
    const mockManager = createVoiceSessionManager({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: createSendTurn('رد') as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
      callbacks: { onStatus: (s) => mockStatuses.push(s) },
    })
    await mockManager.start('c1')
    controller.emitFinal('مرحبا', 0.9)
    await vi.advanceTimersByTimeAsync(2300)
    await Promise.resolve()
    expect(mockStatuses).not.toContain('speaking')
    expect(mockManager.isRealTtsAvailable()).toBe(false)
    mockManager.dispose()

    const { provider: stt2, controller: c2 } = createMockSpeechToTextProvider('')
    const realStatuses: string[] = []
    let speakingFlag = false
    const gate: { release: (() => void) | null } = { release: null }
    const speakingTts: TextToSpeechProvider & { spoken: string[] } = {
      providerId: 'web-speech-tts',
      spoken: [],
      isSupported: () => true,
      async speak(options) {
        this.spoken.push(options.text)
        speakingFlag = true
        await new Promise<void>((resolve) => {
          gate.release = resolve
        })
        speakingFlag = false
      },
      stop() {
        speakingFlag = false
        gate.release?.()
        gate.release = null
      },
      isSpeaking: () => speakingFlag,
    }

    const realManager = createVoiceSessionManager({
      stt: stt2,
      tts: speakingTts,
      sendTurn: createSendTurn('أتحدث الآن') as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      readyHoldMs: 0,
      activityMonitor: silentVad,
      callbacks: { onStatus: (s) => realStatuses.push(s) },
    })
    expect(realManager.isRealTtsAvailable()).toBe(true)
    await realManager.start('c2')
    c2.emitFinal('نعم', 0.9)
    await vi.advanceTimersByTimeAsync(2300)
    await Promise.resolve()
    expect(realStatuses).toContain('speaking')
    expect(realManager.getUxLabelAr()).toBe('يتحدث')
    // Barge-in only while speaking
    const barged = realManager.interrupt()
    expect(barged).toBe(true)
    await Promise.resolve()
    realManager.dispose()
  })

  it('replaces prior manager so only one session is active', async () => {
    const a = createVoiceSessionManager({
      stt: createMockSpeechToTextProvider('').provider,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: silentVad,
    })
    await a.start('c1')
    const b = createVoiceSessionManager({
      stt: createMockSpeechToTextProvider('').provider,
      tts: createMockTextToSpeechProvider(),
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: silentVad,
    })
    expect(a.getStatus()).toBe('idle')
    expect(b.getStatus()).toBe('idle')
    b.dispose()
  })
})
