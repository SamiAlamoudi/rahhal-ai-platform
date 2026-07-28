import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ARABIC_DIALECT_OPTIONS,
  DEFAULT_VOICE_PREFS,
  VOICE_PREFS_STORAGE_KEY,
  buildTtsSpeechInstructions,
  dialectChatGuidance,
  loadVoiceExperiencePrefs,
  normalizeVoiceExperiencePrefs,
  saveVoiceExperiencePrefs,
} from '../chat/voice/voiceExperiencePrefs'
import { isGreetingOnly, replyInventedTravelFacts } from '../agent/conversationBrain/greetingGuard'
import { buildConversationUserPayload } from '../agent/conversationBrain/systemPrompt'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import type { ChatMessage } from '../chat/chatTypes'
import { createLoggingTextToSpeechProvider } from '../chat/voice/voiceProviderFactory'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
  }
}

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
    providerMeta: spokenText ? { spokenText } : {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('voice experience sprint', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('persists voice prefs per user without default travel facts', () => {
    const saved = saveVoiceExperiencePrefs(
      { voiceId: 'coral', dialect: 'moroccan', speed: 'fast', gender: 'female' },
      'user-a',
    )
    expect(saved.voiceId).toBe('coral')
    expect(saved.dialect).toBe('moroccan')
    expect(loadVoiceExperiencePrefs('user-a').speed).toBe('fast')
    expect(loadVoiceExperiencePrefs('user-b')).toEqual(DEFAULT_VOICE_PREFS)
    const raw = localStorage.getItem(`${VOICE_PREFS_STORAGE_KEY}:user-a`)
    expect(raw).toBeTruthy()
    expect(raw).not.toMatch(/10000|إسطنبول|شخصين|budget/i)
  })

  it('aligns voice id with gender preference', () => {
    const prefs = normalizeVoiceExperiencePrefs({
      voiceId: 'coral',
      gender: 'male',
      dialect: 'saudi',
      speed: 'natural',
    })
    expect(prefs.gender).toBe('male')
    expect(['onyx', 'ash', 'echo', 'cedar', 'fable']).toContain(prefs.voiceId)
  })

  it('builds controlled TTS instructions without punctuation tricks', () => {
    const ar = buildTtsSpeechInstructions({ locale: 'ar', dialect: 'saudi' })
    expect(ar).toMatch(/Speak naturally/i)
    expect(ar).toMatch(/warm|confident|calm/i)
    expect(ar).toMatch(/announcer/i)
    expect(ar).toMatch(/navigation system|text reader/i)
    expect(ar).not.toMatch(/\.{3,}|!!!/)
    for (const d of ARABIC_DIALECT_OPTIONS) {
      expect(dialectChatGuidance(d.id).length).toBeGreaterThan(20)
    }
  })

  it('dialect preference does not invent travel facts in payload', () => {
    const payload = buildConversationUserPayload({
      objective: 'greet_or_continue',
      factsJson: JSON.stringify({ known: {} }),
      recentHistory: '(start of conversation)',
      voiceStyleNote: dialectChatGuidance('gulf'),
      currentUserMessage: 'سلام عليكم',
      groundingNote: 'Greeting-only turn',
    })
    expect(payload).toContain('SPEAKING STYLE')
    expect(payload).toMatch(/Never invent travelers/i)
    expect(payload).not.toMatch(/10000|شخصين|إسطنبول/)
  })

  it('greeting stays concise and neutral', () => {
    expect(isGreetingOnly('سلام عليكم')).toBe(true)
    const bad = 'وعليكم السلام، عندنا رحلة لشخصين بميزانية 10000 دولار إلى إسطنبول'
    expect(replyInventedTravelFacts(bad).length).toBeGreaterThan(0)
    const good = 'وعليكم السلام، حياك الله. وين حاب تسافر؟'
    expect(replyInventedTravelFacts(good)).toEqual([])
  })

  it('exactly one TTS request per assistant turn with stable voice options', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('سلام عليكم')
    const tts = createMockTextToSpeechProvider()
    const speakSpy = vi.spyOn(tts, 'speak')
    const sendTurn = vi.fn(async (_input, handlers) => {
      const assistant = assistantMessage(
        'وعليكم السلام، حياك الله. وين حاب تسافر؟',
        'وعليكم السلام، حياك الله. وين حاب تسافر؟',
      )
      handlers.onDelta?.(assistant)
      handlers.onDelta?.({ ...assistant, content: `${assistant.content} ` })
      await handlers.onComplete?.(assistant)
      return {
        user: { ...assistant, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'سلام عليكم' },
        assistant,
      }
    })

    saveVoiceExperiencePrefs({ voiceId: 'marin', dialect: 'saudi', speed: 'natural' }, null)
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      locale: 'ar',
    })

    await session.startPushToTalk()
    await session.stopPushToTalkAndSend('c1')
    expect(speakSpy).toHaveBeenCalledTimes(1)
    expect(speakSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      voice: 'marin',
      dialect: 'saudi',
      interrupt: true,
      format: 'wav',
    }))
    session.dispose()
  })

  it('barge-in stops playback and clears queued audio without duplicate speak', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('مرحبا')
    const tts = createMockTextToSpeechProvider()
    const stopSpy = vi.spyOn(tts, 'stop')
    let resolveSpeak: (() => void) | undefined
    const speakGate = new Promise<void>((resolve) => {
      resolveSpeak = resolve
    })
    tts.speak = vi.fn(async () => {
      await speakGate
    }) as never

    const sendTurn = vi.fn(async (_input, handlers) => {
      const assistant = assistantMessage('رد طويل')
      void handlers.onComplete?.(assistant)
      return {
        user: { ...assistant, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'مرحبا' },
        assistant,
      }
    })

    const session = createVoiceSession({
      stt,
      tts,
      mode: 'hands_free',
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      locale: 'ar',
    })

    await session.startPushToTalk()
    const sendPromise = session.stopPushToTalkAndSend('c1')
    await vi.waitFor(() => expect(tts.speak).toHaveBeenCalled())
    session.interrupt(undefined, { resumeHandsFree: true })
    expect(stopSpy).toHaveBeenCalled()
    resolveSpeak?.()
    await sendPromise.catch(() => undefined)
    expect(tts.speak).toHaveBeenCalledTimes(1)
    session.dispose()
  })

  it('changing voice settings does not reset conversation facts payload', () => {
    saveVoiceExperiencePrefs({ voiceId: 'onyx', gender: 'male' }, 'u1')
    const before = {
      destination: 'إسطنبول',
      travelers: 2,
      budget: 5000,
    }
    saveVoiceExperiencePrefs({ voiceId: 'coral', gender: 'female', dialect: 'white' }, 'u1')
    expect(before).toEqual({
      destination: 'إسطنبول',
      travelers: 2,
      budget: 5000,
    })
    expect(loadVoiceExperiencePrefs('u1').voiceId).toBe('coral')
  })

  it('new conversation clearing travel context preserves voice preferences', () => {
    saveVoiceExperiencePrefs({ voiceId: 'sage', dialect: 'fusha', speed: 'slow' }, 'u9')
    localStorage.removeItem('rahhal.chat.uiRecovery.v1')
    expect(loadVoiceExperiencePrefs('u9')).toEqual(expect.objectContaining({
      voiceId: 'sage',
      dialect: 'fusha',
      speed: 'slow',
    }))
  })

  it('logging TTS wrapper never silently falls back while OpenAI is healthy', async () => {
    const speak = vi.fn(async () => undefined)
    const wrapped = createLoggingTextToSpeechProvider({
      providerId: 'audio-element-tts',
      isSupported: () => true,
      speak,
      stop: () => undefined,
      isSpeaking: () => false,
    })
    await wrapped.speak({ locale: 'ar', text: 'حياك', interrupt: true })
    expect(speak).toHaveBeenCalledTimes(1)
  })
})
