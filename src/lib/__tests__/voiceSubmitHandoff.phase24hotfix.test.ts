/**
 * Phase 2.4 hotfix — final transcript must invoke real submit (not onChange-only),
 * survive iOS Safari location.state drops, and never silent-READY without submit/error.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildVoiceAwareChatNavigation,
  clearVoiceEntryHandoff,
  readVoiceEntryHandoff,
  resolveChatEntrySeed,
  writeVoiceEntryHandoff,
  VOICE_ENTRY_STORAGE_KEY,
} from '../aiHome/voiceEntryHandoff'
import { conversationEntryPath } from '../aiHome/homeModel'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
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

describe('Phase 2.4 hotfix — voice submit handoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      clear: () => store.clear(),
      key: () => null,
      get length() {
        return store.size
      },
    })
    clearVoiceEntryHandoff()
  })
  afterEach(() => {
    clearVoiceEntryHandoff()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('durable handoff keeps seed+startVoice when router state is empty (iOS Safari)', () => {
    writeVoiceEntryHandoff({
      seed: 'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع',
      startVoice: true,
      turnId: 't1',
    })
    expect(sessionStorage.getItem(VOICE_ENTRY_STORAGE_KEY)).toBeTruthy()

    // Simulate Safari dropping location.state — only session remains.
    const resolved = resolveChatEntrySeed({ state: null, search: '' })
    expect(resolved.source).toBe('session')
    expect(resolved.seed).toContain('المغرب')
    expect(resolved.startVoice).toBe(true)
  })

  it('buildVoiceAwareChatNavigation writes query startVoice and session seed', () => {
    const nav = buildVoiceAwareChatNavigation('أفضل أكادير', { startVoice: true })
    expect(nav.pathname).toBe('/chat')
    expect(nav.search).toContain('startVoice=1')
    expect(nav.search).toContain('seed=')
    expect(nav.state.startVoice).toBe(true)
    expect(readVoiceEntryHandoff()?.seed).toBe('أفضل أكادير')
  })

  it('conversationEntryPath voice and text share seed keys; voice marks startVoice', () => {
    const text = conversationEntryPath('مرحبا')
    const voice = conversationEntryPath('مرحبا', { startVoice: true })
    expect(text.state.seedMessage).toBe(voice.state.seedMessage)
    expect(voice.state.startVoice).toBe(true)
    expect(voice.search).toContain('startVoice=1')
    expect(text.search).not.toContain('startVoice=1')
  })

  it('resolve prefers state, then query, then session', () => {
    writeVoiceEntryHandoff({ seed: 'from-session', startVoice: true })
    expect(
      resolveChatEntrySeed({
        state: { seedMessage: 'from-state', startVoice: true },
        search: '?seed=from-query&startVoice=1',
      }).source,
    ).toBe('state')
    expect(
      resolveChatEntrySeed({
        state: null,
        search: '?seed=from-query&startVoice=1',
      }).seed,
    ).toBe('from-query')
  })

  it('final transcript invokes ChatEngine exactly once; empty/interim not submitted', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (input: { content: string }, handlers: {
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
      silenceTimeoutMs: 2200,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
    })

    await session.beginContinuousWithSeed(
      'c1',
      'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع وميزانيتي 10,000 ريال',
    )
    expect(sendTurn).toHaveBeenCalledTimes(1)
    expect(tts.spoken.length).toBeGreaterThan(0)

    // Empty final must not create another turn.
    controller.emitFinal('   ')
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(1)

    // Second real turn.
    controller.emitFinal('أفضل أكادير')
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(2)
    expect(sendTurn.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ content: 'أفضل أكادير' }),
    )
    session.dispose()
  })

  it('duplicate seed submissions are ignored', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
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
    const seed = 'نفس الجملة بالضبط'
    await session.beginContinuousWithSeed('c1', seed)
    await session.beginContinuousWithSeed('c1', seed)
    expect(sendTurn).toHaveBeenCalledTimes(1)
    session.dispose()
  })

  it('assistant response triggers TTS; TTS completion resumes listening', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
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
    expect(tts.spoken.some((t) => t.includes('أكادير'))).toBe(true)
    expect(statuses).toContain('listening')

    controller.emitFinal('نعم أكادير')
    await vi.advanceTimersByTimeAsync(2300)
    expect(sendTurn).toHaveBeenCalledTimes(2)
    session.dispose()
  })

  it('home voice entry does not require ابدأ المحادثة click (startVoice handoff)', () => {
    const entry = conversationEntryPath(
      'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع من 1 أغسطس إلى 8 أغسطس وميزانيتي 10,000 ريال',
      { startVoice: true },
    )
    // Navigating with this entry is sufficient — no secondary CTA.
    expect(entry.pathname).toBe('/chat')
    expect(entry.state.startVoice).toBe(true)
    expect(entry.search).toContain('startVoice=1')
    // Survives empty state via session:
    const recovered = resolveChatEntrySeed({ state: {}, search: '' })
    expect(recovered.seed).toContain('المغرب')
    expect(recovered.startVoice).toBe(true)
  })
})
