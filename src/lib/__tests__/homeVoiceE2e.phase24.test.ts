/**
 * Recovery Phase 2.4 — home voice auto-submit + continuous chat handoff.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { conversationEntryPath } from '../aiHome/homeModel'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { extractSpokenAnswer } from '../chat/voice/spokenAnswer'
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
    providerMeta: spokenText ? { spokenText, voicePhase: 'final' } : {},
    createdAt: '2026-07-26T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z',
  }
}

describe('Recovery Phase 2.4 — home voice end-to-end', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('voice entry path marks startVoice and uses the same chat seed keys as text', () => {
    const textEntry = conversationEntryPath('أريد المغرب')
    expect(textEntry.pathname).toBe('/chat')
    expect(textEntry.state.seedMessage).toBe('أريد المغرب')
    expect(textEntry.state.startVoice).toBeUndefined()
    expect(textEntry.search).not.toContain('startVoice=1')

    const voiceEntry = conversationEntryPath('أريد المغرب', { startVoice: true })
    expect(voiceEntry.state.startVoice).toBe(true)
    expect(voiceEntry.state.seedMessage).toBe(voiceEntry.state.tripText)
    expect(voiceEntry.state.initialPrompt).toBe('أريد المغرب')
    expect(voiceEntry.search).toContain('startVoice=1')
  })

  it('beginContinuousWithSeed auto-submits once through chatEngine (no second CTA)', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const sendTurn = vi.fn(async (input: { content: string; modality: string }, handlers: {
      onComplete?: (m: ChatMessage) => void | Promise<void>
    }) => {
      const reply = assistant('ما هي مدينة المغادرة؟', 'ما هي مدينة المغادرة؟')
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
      locale: 'ar',
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    const seed =
      'أريد السفر إلى المغرب لمدة أسبوع مع زوجتي وميزانيتي عشرة آلاف ريال'
    await session.beginContinuousWithSeed('c1', seed)

    expect(sendTurn).toHaveBeenCalledTimes(1)
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'c1',
        content: seed,
        modality: 'audio',
      }),
      expect.any(Object),
    )
    // Same pipeline — no "ابدأ المحادثة" required after seed.
    expect(tts.spoken.some((t) => t.includes('مدينة') || t.includes('المغادرة'))).toBe(true)
    session.dispose()
  })

  it('assistant TTS starts after final response and recognition resumes', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    let speakOrder = 0
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('هل تفضل أكادير أم مراكش؟', 'هل تفضل أكادير أم مراكش؟')
      await handlers.onComplete?.(reply)
      speakOrder = tts.spoken.length
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
      silenceTimeoutMs: 2200,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    expect(speakOrder).toBeGreaterThan(0)
    expect(statuses).toContain('ready')
    // After TTS, continuous listening resumes once (authorized delay).
    const { HANDS_FREE_LISTEN_RESTART_MS } = await import('../chat/voice/voiceSession')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(statuses).toContain('listening')
    expect(session.getMode()).toBe('hands_free')
    // READY must precede the next STT session; no fake IDLE from mic re-check.
    const readyIdx = statuses.indexOf('ready')
    const listenIdx = statuses.indexOf('listening', readyIdx + 1)
    expect(listenIdx).toBeGreaterThan(readyIdx)
    expect(statuses.slice(readyIdx, listenIdx)).not.toContain('idle')

    // Turn 2 without pressing mic again.
    controller.emitFinal('أفضل أكادير والرحلة من الرياض')
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(2)
    expect(sendTurn.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        content: 'أفضل أكادير والرحلة من الرياض',
        modality: 'audio',
      }),
    )
    session.dispose()
  })

  it('commits turn 2 after recognition onend without clearing the silence window', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('حسناً، أكادير من الرياض.', 'حسناً، أكادير من الرياض.')
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
      silenceTimeoutMs: 2200,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
    })

    await session.beginContinuousWithSeed('c1', 'أريد المغرب')
    expect(sendTurn).toHaveBeenCalledTimes(1)
    const { HANDS_FREE_LISTEN_RESTART_MS: restartMs } = await import('../chat/voice/voiceSession')
    await vi.advanceTimersByTimeAsync(restartMs)

    // Simulate browser STT: final chunk then immediate onend (restart thrash).
    controller.emitFinal('أفضل أكادير والرحلة من الرياض')
    controller.emitEnd()
    controller.emitEnd()
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(2)
    expect(sendTurn.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ content: 'أفضل أكادير والرحلة من الرياض' }),
    )
    session.dispose()
  })

  it('stops recognition during TTS and ignores duplicate seed submissions', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('echo')
    const abortSpy = vi.spyOn(stt, 'abort')
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
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
    })

    await session.beginContinuousWithSeed('c1', 'نفس الجملة')
    expect(abortSpy).toHaveBeenCalled()
    await session.beginContinuousWithSeed('c1', 'نفس الجملة')
    expect(sendTurn).toHaveBeenCalledTimes(1)

    await session.stopListening()
    expect(session.getStatus()).toBe('idle')
    session.dispose()
    expect(stt.onPartial).toBeUndefined()
  })

  it('extractSpokenAnswer prefers spokenText and strips chrome', () => {
    expect(
      extractSpokenAnswer({
        content: '## Plan\nhttps://example.com\n**SAR 1,200**\n',
        spokenText: 'ما ميزانيتك تقريباً؟',
      }),
    ).toBe('ما ميزانيتك تقريباً؟')

    const cleaned = extractSpokenAnswer({
      content: 'مرحبا بك في رحّال\nhttps://x.test\n| price | 100 |',
      spokenText: null,
    })
    expect(cleaned).toContain('مرحبا')
    expect(cleaned).not.toMatch(/https?:/)
  })
})
