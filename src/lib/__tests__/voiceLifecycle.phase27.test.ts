/**
 * Recovery Phase 2.7 — VoiceSession lifecycle after a successful assistant turn.
 * Single restart owner, READY before listen, no restart during TTS, stale onend ignored.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createVoiceSession,
  HANDS_FREE_LISTEN_RESTART_MS,
} from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { createTravelAgentService } from '../agent/travelAgentService'
import { resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'
import { createSpeechRecognitionSession } from '../../hooks/useSpeechRecognition'
import { getVoiceTraceRecords, clearVoiceTrace } from '../chat/voice/voiceDebugTrace'

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
    providerMeta: spokenText ? { spokenText } : { spokenText: content },
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

function userMsg(content: string): ChatMessage {
  return {
    id: 'u1',
    conversationId: 'c1',
    role: 'user',
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

const noopVad = {
  start: async () => {},
  stop: () => {},
  isSpeaking: () => false,
  getLevel: () => 0,
  isActive: () => false,
}

describe('Phase 2.7 — VoiceSession lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearVoiceTrace()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('A: two-turn Arabic voice — TTS → READY → exactly one LISTENING restart → turn 2', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const startSpy = vi.spyOn(stt, 'start')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const completed: string[] = []
    const sendTurn = vi.fn(async (input: { content: string }, handlers: {
      onComplete?: (m: ChatMessage) => void | Promise<void>
    }) => {
      const reply = input.content.includes('أجواء')
        ? assistant('أكادير خيار ممتاز للاسترخاء.', 'أكادير خيار ممتاز للاسترخاء.')
        : assistant(
          'رحلة جميلة. هل تفضّلان أجواء البحر أم الثقافة؟',
          'رحلة جميلة. هل تفضّلان أجواء البحر أم الثقافة؟',
        )
      await handlers.onComplete?.(reply)
      completed.push(reply.content)
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
      callbacks: { onStatus: (s) => statuses.push(s), onComplete: (m) => completed.push(`ui:${m.content}`) },
    })

    await session.beginContinuousWithSeed(
      'c1',
      'أريد السفر إلى المغرب مع زوجتي أسبوع وميزانيتي 10,000 ريال',
    )

    expect(statuses).toContain('speaking')
    expect(statuses).toContain('ready')
    expect(session.getStatus()).toBe('ready')
    // Restart is delayed — not listening yet.
    expect(session.getStatus()).not.toBe('listening')
    const startsAfterTurn1 = startSpy.mock.calls.length

    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    expect(startSpy.mock.calls.length).toBe(startsAfterTurn1 + 1)

    const readyIdx = statuses.indexOf('ready')
    const listenIdx = statuses.indexOf('listening', readyIdx + 1)
    expect(listenIdx).toBeGreaterThan(readyIdx)
    expect(statuses.slice(readyIdx, listenIdx)).not.toContain('idle')

    controller.emitFinal('أفضل أجواء البحر')
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(2)
    expect(tts.spoken.some((t) => t.includes('أكادير'))).toBe(true)
    expect(completed.some((c) => c.includes('أكادير'))).toBe(true)

    session.dispose()
  })

  it('B: no duplicate STT start after post-turn resume', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const startSpy = vi.spyOn(stt, 'start')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('هل تفضل أكادير؟')
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
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    const starts = startSpy.mock.calls.length

    // Spurious browser onend must schedule at most one recovery — not a burst.
    controller.emitEnd()
    controller.emitEnd()
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(startSpy.mock.calls.length).toBeLessThanOrEqual(starts + 1)

    session.dispose()
  })

  it('C: does not restart STT before TTS_END', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const startSpy = vi.spyOn(stt, 'start')
    const tts = createMockTextToSpeechProvider({ delayMs: 500 })
    const statuses: string[] = []
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('مرحباً بك')
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

    const seedPromise = session.beginContinuousWithSeed('c1', 'أريد المغرب')
    // While TTS is in flight, advance less than TTS delay — must not listen yet.
    await vi.advanceTimersByTimeAsync(200)
    expect(statuses).toContain('speaking')
    expect(session.getStatus()).toBe('speaking')
    expect(startSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)
    await seedPromise
    expect(statuses).toContain('ready')
    expect(startSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    expect(startSpy).toHaveBeenCalledTimes(1)

    session.dispose()
  })

  it('D: stale recognition.onend cannot restart a disposed session', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const startSpy = vi.spyOn(stt, 'start')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً')
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
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    const starts = startSpy.mock.calls.length

    session.dispose()
    controller.emitEnd()
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS * 3)
    expect(startSpy.mock.calls.length).toBe(starts)
    expect(session.getStatus()).toBe('idle')
  })

  it('E: empty WebKit restart does not create a message and does not enter Thinking', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const statuses: string[] = []
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('هل تفضل أكادير؟')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2200,
      activityMonitor: noopVad,
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    const callsAfterSeed = sendTurn.mock.calls.length

    controller.emitFinal('   ')
    controller.emitEnd()
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(callsAfterSeed)
    expect(statuses.filter((s) => s === 'thinking')).toHaveLength(1)

    session.dispose()
  })

  it('G: explicit stop cancels pending restart timers', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const startSpy = vi.spyOn(stt, 'start')
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'x' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts: createMockTextToSpeechProvider(),
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      activityMonitor: noopVad,
    })

    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    expect(session.getStatus()).toBe('ready')
    await session.stopListening()
    expect(session.getStatus()).toBe('idle')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS * 2)
    expect(startSpy).not.toHaveBeenCalled()
    session.dispose()
  })

  it('H: dispose clears recognition, TTS, timers, and handlers', async () => {
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider({ delayMs: 1_000 })
    const stopSpy = vi.spyOn(tts, 'stop')
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً')
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

    const seedPromise = session.beginContinuousWithSeed('c1', 'أريد المغرب')
    await vi.advanceTimersByTimeAsync(50)
    session.dispose()
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS + 1_200)
    await seedPromise.catch(() => {})
    expect(stopSpy).toHaveBeenCalled()
    expect(stt.onEnd).toBeUndefined()
    expect(stt.onPartial).toBeUndefined()
    controller.emitEnd()
    expect(session.getStatus()).toBe('idle')
  })
})

describe('Phase 2.7 — stt_no_result_watchdog recovery (F)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearVoiceTrace()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('F: watchdog recovers to idle without permanent ERROR', async () => {
    type HandlerMap = {
      onstart: ((ev: Event) => void) | null
      onresult: ((ev: unknown) => void) | null
      onerror: ((ev: { error: string }) => void) | null
      onend: ((ev: Event) => void) | null
    }
    type MockRecognition = HandlerMap & {
      lang: string
      continuous: boolean
      start: () => void
      stop: () => void
      abort: () => void
    }
    const instances: MockRecognition[] = []
    const Ctor = class MockSpeechRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onstart: HandlerMap['onstart'] = null
      onresult: HandlerMap['onresult'] = null
      onerror: HandlerMap['onerror'] = null
      onend: HandlerMap['onend'] = null
      constructor() {
        instances.push(this)
      }
      start() {
        queueMicrotask(() => this.onstart?.(new Event('start')))
      }
      stop() {
        queueMicrotask(() => this.onend?.(new Event('end')))
      }
      abort() {
        this.onend?.(new Event('end'))
      }
    }

    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 60_000,
      maxListenMs: 120_000,
      noResultWatchdogMs: 8_000,
      onResult: vi.fn(),
    })
    session.start()
    await Promise.resolve()
    expect(session.getSnapshot().isListening).toBe(true)
    await vi.advanceTimersByTimeAsync(8_000)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(400)
    await Promise.resolve()
    expect(session.getSnapshot().status).toBe('idle')
    expect(session.getSnapshot().isListening).toBe(false)
    expect(
      getVoiceTraceRecords().some(
        (r) => r.stage === 'FAILURE' && r.reason === 'stt_no_result_watchdog',
      ),
    ).toBe(true)
    session.dispose()
  })
})

describe('Phase 2.7 — consultant regression (I)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('I: Morocco couple week 10k — preserve facts, one question, no عندي, no cards', async () => {
    const service = createTravelAgentService()
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [
        userMsg('أريد السفر إلى المغرب مع زوجتي أسبوع وميزانيتي 10,000 ريال.'),
      ],
    })

    const memory = turn.meta.memory?.requirements
    expect(memory?.destination).toMatch(/Morocco|المغرب/i)
    expect(memory?.durationDays).toBe(7)
    expect(memory?.budgetAmount).toBe(10000)
    expect(memory?.travelerType === 'couple' || memory?.travelers === 2).toBe(true)

    expect(turn.reply).not.toContain('عندي')
    expect(turn.reply).not.toMatch(/اختر من التالي|قم بتعبئة|لدينا عرض/)
    expect((turn.reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
    expect(turn.tripPlan).toBeNull()

    const attachments = (turn.meta as { attachments?: unknown[] }).attachments
    expect(attachments == null || attachments.length === 0).toBe(true)
    expect(turn.meta.spokenText).toBeTruthy()
  })
})
