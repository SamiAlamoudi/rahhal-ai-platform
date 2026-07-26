/**
 * Recovery Phase 2.6 — TTS completion + voice consultant turn control.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createVoiceSession,
  HANDS_FREE_LISTEN_RESTART_MS,
} from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import {
  estimateTtsWatchdogMs,
  extractSpokenAnswer,
  MAX_SPOKEN_CHARS,
  prepareVoiceSpokenText,
  sanitizeSpokenArabic,
} from '../chat/voice/spokenAnswer'
import { clearVoiceTrace, getVoiceTraceRecords } from '../chat/voice/voiceDebugTrace'
import type { ChatMessage } from '../chat/chatTypes'

function assistant(content: string, spokenText?: string): ChatMessage {
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
    providerMeta: spokenText
      ? { spokenText, voicePhase: 'final' }
      : { spokenText: content, voicePhase: 'final' },
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

const noopVad = {
  start: async () => {},
  stop: () => {},
  isSpeaking: () => false,
  getLevel: () => 0,
  isActive: () => false,
}

describe('Phase 2.6 — TTS completion lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearVoiceTrace()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('1: final assistant response starts TTS exactly once', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('رحلة جميلة إلى المغرب.', 'رحلة جميلة إلى المغرب.')
      handlers.onDelta?.({
        ...reply,
        status: 'streaming',
        content: 'رحلة',
        providerMeta: { spokenText: 'رحلة', voicePhase: 'bridge' },
      })
      handlers.onDelta?.({
        ...reply,
        status: 'streaming',
        content: 'رحلة جميلة',
        providerMeta: { spokenText: 'رحلة جميلة', voicePhase: 'bridge' },
      })
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    expect(tts.speakCalls).toBe(1)
    expect(tts.spoken[0]).toContain('المغرب')
    session.dispose()
  })

  it('2: partial streaming deltas do not create overlapping TTS', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('الجواب النهائي', 'الجواب النهائي')
      handlers.onDelta?.({
        ...reply,
        status: 'streaming',
        providerMeta: { spokenText: 'جزئي واحد', voicePhase: 'bridge' },
      })
      expect(tts.speakCalls).toBe(0)
      handlers.onDelta?.({
        ...reply,
        status: 'streaming',
        providerMeta: { spokenText: 'جزئي اثنان', voicePhase: 'bridge' },
      })
      expect(tts.speakCalls).toBe(0)
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    await session.beginContinuousWithSeed('c1', 'مرحبا')
    expect(tts.speakCalls).toBe(1)
    expect(tts.spoken[0]).toContain('النهائي')
    session.dispose()
  })

  it('3: TTS end transitions SPEAKING → READY → LISTENING', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('هل تفضل أكادير؟', 'هل تفضل أكادير؟')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
      callbacks: { onStatus: (s) => statuses.push(s) },
    })
    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    expect(statuses).toContain('speaking')
    expect(statuses).toContain('ready')
    expect(session.getStatus()).toBe('ready')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    const readyIdx = statuses.indexOf('ready')
    const listenIdx = statuses.indexOf('listening', readyIdx + 1)
    expect(statuses.slice(readyIdx, listenIdx)).not.toContain('idle')
    session.dispose()
  })

  it('4: TTS error recovers without refresh', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    tts.speak = async () => {
      throw new Error('تعذر تشغيل الصوت')
    }
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً', 'حسناً')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    await session.beginContinuousWithSeed('c1', 'مرحبا')
    expect(session.getStatus()).toBe('ready')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    session.dispose()
  })

  it('5: missing onend is recovered by watchdog', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider({ hangUntilStop: true })
    const statuses: string[] = []
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('نص قصير', 'نص قصير')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
      callbacks: { onStatus: (s) => statuses.push(s) },
    })
    const p = session.beginContinuousWithSeed('c1', 'مرحبا')
    await Promise.resolve()
    expect(session.getStatus()).toBe('speaking')
    const watchdog = estimateTtsWatchdogMs('نص قصير')
    await vi.advanceTimersByTimeAsync(watchdog + 50)
    await p
    expect(statuses).toContain('ready')
    expect(session.getStatus()).toBe('ready')
    const timeout = getVoiceTraceRecords().find((r) => r.stage === 'TTS_TIMEOUT')
    expect(timeout).toBeTruthy()
    session.dispose()
  })

  it('6+7: duplicate onend / late onend after timeout is ignored', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider({ hangUntilStop: true })
    const startSpy = vi.spyOn(stt, 'start')
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('مرحبا', 'مرحبا')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    const p = session.beginContinuousWithSeed('c1', 'hi')
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(estimateTtsWatchdogMs('مرحبا') + 20)
    await p
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    const starts = startSpy.mock.calls.length
    // Late stop/onend from hung utterance must not schedule another listen.
    tts.stop()
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS * 2)
    expect(startSpy.mock.calls.length).toBe(starts)
    session.dispose()
  })

  it('8+9: interruption cancels speech; stale callback cannot finish newer turn', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider({ hangUntilStop: true })
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('أتحدث الآن', 'أتحدث الآن')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    const p = session.beginContinuousWithSeed('c1', 'مرحبا')
    await Promise.resolve()
    expect(session.getStatus()).toBe('speaking')
    session.interrupt(undefined, { resumeHandsFree: true })
    await p.catch(() => {})
    expect(session.getStatus()).toBe('ready')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    // Stale completion from cancelled utterance
    tts.stop()
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    session.dispose()
  })

  it('10: chat completion clears sending before TTS settles (no Thinking stuck)', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider({ hangUntilStop: true })
    const statuses: string[] = []
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('رد', 'رد')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
      callbacks: { onStatus: (s) => statuses.push(s) },
    })
    const p = session.beginContinuousWithSeed('c1', 'hi')
    await Promise.resolve()
    // After onComplete, status is speaking — not stuck in thinking/responding.
    expect(session.getStatus()).toBe('speaking')
    expect(statuses.filter((s) => s === 'thinking').length).toBeGreaterThan(0)
    expect(statuses[statuses.length - 1]).toBe('speaking')
    session.interrupt()
    await p.catch(() => {})
    expect(session.getStatus()).toBe('ready')
    session.dispose()
  })

  it('11: continuous mode restarts listening exactly once', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const startSpy = vi.spyOn(stt, 'start')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً', 'حسناً')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    await session.beginContinuousWithSeed('c1', 'مرحبا')
    expect(startSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(startSpy).toHaveBeenCalledTimes(1)
    session.dispose()
  })

  it('12: push-to-talk ends at READY and does not auto-listen', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('رحلة')
    const startSpy = vi.spyOn(stt, 'start')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً', 'حسناً')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'رحلة' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })
    await session.startPushToTalk()
    const startsAfterPtt = startSpy.mock.calls.length
    await session.stopPushToTalkAndSend('c1')
    expect(session.getStatus()).toBe('ready')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS * 2)
    expect(startSpy.mock.calls.length).toBe(startsAfterPtt)
    session.dispose()
  })

  it('16: second voice turn works without another Start Conversation action', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (input: { content: string }, handlers: {
      onComplete?: (m: ChatMessage) => void | Promise<void>
    }) => {
      const reply = input.content.includes('أكادير')
        ? assistant('أكادير ممتاز.', 'أكادير ممتاز.')
        : assistant('هل تفضل أكادير؟', 'هل تفضل أكادير؟')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: input.content },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      activityMonitor: noopVad,
    })
    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    controller.emitFinal('أفضل أكادير')
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(2)
    session.dispose()
  })
})

describe('Phase 2.6 — spoken presentation (13–15)', () => {
  it('13: Arabic spoken text contains no markdown or URLs', () => {
    const spoken = sanitizeSpokenArabic(
      '## عنوان\n- بند\nانظر https://example.com و **SAR 1,200** 😊',
    )
    expect(spoken).not.toMatch(/https?:/)
    expect(spoken).not.toContain('##')
    expect(spoken).not.toContain('**')
    expect(spoken).not.toContain('😊')
  })

  it('14: long visual response produces a shorter spoken response', () => {
    const long = Array.from({ length: 40 }, (_, i) => `جملة رقم ${i + 1} عن الرحلة.`).join(' ')
    const spoken = prepareVoiceSpokenText({ content: long, spokenText: long })
    expect(spoken.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS)
    expect(spoken.length).toBeLessThan(long.length)
  })

  it('15: extractSpokenAnswer prefers spokenText and stays concise', () => {
    const spoken = extractSpokenAnswer({
      content: `${'تفاصيل طويلة '.repeat(80)}https://x.test`,
      spokenText: 'رحلة جميلة. هل تفضّلان البحر أم المدينة؟',
    })
    expect(spoken).toContain('البحر')
    expect(spoken).not.toMatch(/https?:/)
    expect(spoken.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS)
  })
})
