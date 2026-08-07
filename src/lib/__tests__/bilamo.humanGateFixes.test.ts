/**
 * Human-gate regressions: audible recovery, Arabic STT hygiene, Yemen≠Japan, dedupe.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  collapseDuplicatedTranscript,
  isEnglishAsrPollution,
  sanitizeArabicVoiceTranscript,
  stripEnglishTokenPollution,
} from '../chat/voice/sanitizeArabicVoiceTranscript'
import { createArabicUtteranceAssembler } from '../chat/voice/arabicUtteranceAssembler'
import { resolveDestinationIdentity } from '../agent/destinationIdentity'
import { extractBilamoEntities } from '../bilamo/intelligence/entityExtraction'
import { emptyBilamoMemory } from '../bilamo/intelligence/smartMemory'
import { nearestAirport } from '../bilamo/departure/departureLocator'
import {
  createBilamoVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  type BilamoVoiceConnectionState,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportCallbacks,
} from '../bilamo/voice'

vi.mock('../chat/voice/audioElementTextToSpeechProvider', () => ({
  unlockAudioPlayback: vi.fn(async () => undefined),
  preconnectOpenAiTtsRoute: vi.fn(),
}))

afterEach(() => {
  resetSharedBilamoVoiceSessionForTests()
})

describe('Arabic STT hygiene', () => {
  it('strips English pollution like Down', () => {
    expect(isEnglishAsrPollution('Down')).toBe(true)
    expect(sanitizeArabicVoiceTranscript('Down')).toBe('')
    expect(stripEnglishTokenPollution('أريد السفر Down إلى اليمن')).toContain('اليمن')
    expect(stripEnglishTokenPollution('أريد السفر Down إلى اليمن')).not.toMatch(/Down/i)
  })

  it('collapses duplicated interim+final append', () => {
    const dup = 'أريد السفر إلى اليابان أريد السفر إلى اليابان'
    expect(collapseDuplicatedTranscript(dup)).toBe('أريد السفر إلى اليابان')
    expect(sanitizeArabicVoiceTranscript(dup)).toBe('أريد السفر إلى اليابان')
  })

  it('assembler commit does not append interim on top of segment final', () => {
    const commits: string[] = []
    const assembler = createArabicUtteranceAssembler({
      conversationLanguage: () => 'ar',
      nowMs: () => 2000,
      onCommit: (r) => commits.push(r.committedTranscript),
      onReject: () => undefined,
    })
    assembler.onSpeechStarted(0)
    assembler.onSegmentFinal('أريد السفر إلى اليمن')
    assembler.onInterim('أريد السفر إلى اليمن')
    assembler.forceCommitNow()
    expect(commits).toHaveLength(1)
    expect(commits[0]).toBe('أريد السفر إلى اليمن')
    expect(commits[0]).not.toMatch(/أريد السفر إلى اليمن أريد/)
  })
})

describe('Yemen stays Yemen', () => {
  it('resolves اليمن to Yemen identity not Japan', () => {
    const id = resolveDestinationIdentity('اليمن')
    expect(id?.label).toMatch(/اليمن|Yemen/i)
    expect(id?.country).toMatch(/Yemen/i)
    expect(id?.label).not.toMatch(/Japan/i)
  })

  it('extractBilamoEntities does not map اليمن to Japan', () => {
    const turn = extractBilamoEntities({
      userText: 'أبغى أسافر اليمن الأسبوع القادم',
      memory: emptyBilamoMemory('ar'),
    })
    expect(turn.requirements.destination).toMatch(/اليمن|Yemen/i)
    expect(String(turn.requirements.destination)).not.toMatch(/Japan/i)
  })

  it('protects اليمن when English Japan pollutes the same string', () => {
    const cleaned = sanitizeArabicVoiceTranscript('أريد السفر إلى اليمن Japan')
    expect(cleaned).toContain('اليمن')
    expect(cleaned).not.toMatch(/Japan/i)
  })
})

describe('departure locator', () => {
  it('maps Riyadh coordinates to RUH', () => {
    const airport = nearestAirport(24.71, 46.67)
    expect(airport.code).toBe('RUH')
    expect(airport.cityAr).toBe('الرياض')
  })
})

describe('mandatory audible recovery', () => {
  it('playback_blocked triggers classic speak instead of text-only idle', async () => {
    let callbacks: BilamoVoiceTransportCallbacks = {}
    let realtimeSpeakCount = 0
    let connection: BilamoVoiceConnectionState = 'idle'
    let disposed = false
    const realtime: BilamoVoiceTransport = {
      kind: 'realtime_webrtc',
      setCallbacks(next) {
        callbacks = next || {}
      },
      async connect() {
        connection = 'connected'
        callbacks.onConnectionStateChange?.('connected')
      },
      disconnect() {
        connection = 'disconnected'
      },
      async startListening() {
        return true
      },
      stopListening() {},
      speak(req) {
        void req.text
        realtimeSpeakCount += 1
        const generation = realtimeSpeakCount
        // First speak fails; reconnect speak also fails once — then classic takes over.
        queueMicrotask(() => {
          if (disposed) return
          callbacks.onError?.('تعذر تشغيل الصوت.', {
            code: 'playback_blocked',
            recoverable: true,
          })
          callbacks.onSpeakingEnd?.(generation)
        })
        return { generation, done: Promise.resolve() }
      },
      interrupt() {},
      stop() {},
      isSpeaking: () => false,
      isListening: () => false,
      isConnected: () => connection === 'connected',
      getConnectionState: () => connection,
      dispose() {
        disposed = true
      },
    }

    let classicSpeaks = 0
    const classic: BilamoVoiceTransport = {
      kind: 'classic_tts',
      setCallbacks(next) {
        callbacks = next || {}
      },
      async connect() {
        connection = 'connected'
        callbacks.onConnectionStateChange?.('connected')
      },
      disconnect() {},
      async startListening() {
        return true
      },
      stopListening() {},
      speak({ text }) {
        void text
        classicSpeaks += 1
        const generation = 500 + classicSpeaks
        queueMicrotask(() => {
          callbacks.onSpeakingStart?.(generation)
          callbacks.onAudioChunk?.({ generation })
          callbacks.onSpeakingEnd?.(generation)
        })
        return { generation, done: Promise.resolve() }
      },
      interrupt() {},
      stop() {},
      isSpeaking: () => false,
      isListening: () => false,
      isConnected: () => true,
      getConnectionState: () => 'connected',
      dispose() {},
    }

    let useClassic = false
    const session = createBilamoVoiceSession({
      mode: 'realtime',
      createTransport: async ({ forceClassic } = {}) => {
        if (forceClassic || useClassic) {
          useClassic = true
          return {
            transport: classic,
            mode: 'classic',
            selected: 'classic_tts',
            fellBack: true,
            reason: 'playback',
          }
        }
        return {
          transport: realtime,
          mode: 'realtime',
          selected: 'realtime_webrtc',
          fellBack: false,
          reason: null,
        }
      },
    })

    await session.connect()
    session.speak('مرحبا بك في بيلامو', 'ar')
    // Allow reconnect + classic recovery microtasks.
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 0))
      if (classicSpeaks > 0 || session.getSnapshot().fellBackToClassic) break
    }
    expect(session.getSnapshot().error || '').not.toMatch(/بالنص/)
    expect(classicSpeaks).toBeGreaterThanOrEqual(1)
    expect(session.getSnapshot().playback.classicFallbackInvoked || session.getSnapshot().fellBackToClassic).toBe(true)
    session.dispose()
  })
})
