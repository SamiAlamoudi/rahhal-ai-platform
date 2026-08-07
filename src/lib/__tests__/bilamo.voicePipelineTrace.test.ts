/**
 * Mic → speaker pipeline stage regressions (no new features / fallbacks).
 * Stages: language detect → transcript accept → ASR locale → speak locale.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  createUserTranscriptGate,
  isUnsupportedInterimScript,
  transcriptionLanguageHint,
} from '../chat/voice/userTranscriptGate'
import { replyLocaleToVoiceLocale } from '../bilamo/speech/localeBridge'
import { normalizeVoiceLocale, speechLangForLocale, VOICE_LOCALES } from '../chat/voice/voiceTypes'
import { detectSpeechLang } from '../../hooks/useSpeechRecognition'

describe('pipeline — Language detected / Transcript normalized', () => {
  it('French reply locale stays fr for voice ASR (not collapsed to en)', () => {
    expect(replyLocaleToVoiceLocale('fr')).toBe('fr')
    expect(normalizeVoiceLocale('fr')).toBe('fr')
    expect(speechLangForLocale('fr')).toBe('fr-FR')
    expect(VOICE_LOCALES.fr.speechLang).toBe('fr-FR')
    expect(detectSpeechLang('fr-FR')).toBe('fr-FR')
  })

  it('transcription hint for French is fr (not ar)', () => {
    expect(transcriptionLanguageHint('fr')).toBe('fr')
    expect(transcriptionLanguageHint('en')).toBe('en')
    expect(transcriptionLanguageHint('ar')).toBe('ar')
  })

  it('French Latin finals are accepted when ASR language is fr', () => {
    expect(isUnsupportedInterimScript('Je veux partir à Bali la semaine prochaine', 'fr')).toBe(false)
    const gate = createUserTranscriptGate(() => 'fr')
    gate.resetTurn()
    const final = gate.ingestFinal('Je veux partir à Bali la semaine prochaine avec ma femme.')
    expect(final.accepted).toBe(true)
    expect(final.exactText).toMatch(/Bali/i)
    expect(final.lockedLanguage).toBe('fr')
  })

  it('English Latin finals are accepted when ASR language is en', () => {
    const gate = createUserTranscriptGate(() => 'en')
    gate.resetTurn()
    const final = gate.ingestFinal('I want to fly to Paris next Friday.')
    expect(final.accepted).toBe(true)
    expect(final.exactText).toMatch(/Paris/i)
  })

  it('Arabic-locked turns still reject foreign Latin finals (no pollution)', () => {
    expect(isUnsupportedInterimScript('I want to travel to Thailand', 'ar')).toBe(true)
    const gate = createUserTranscriptGate(() => 'ar')
    gate.resetTurn()
    gate.lockLanguage('ar')
    const rejected = gate.ingestFinal('I want to travel to Thailand for a week')
    expect(rejected.accepted).toBe(false)
  })
})

describe('pipeline — TTS language lock must match reply language', () => {
  it('speakWrittenDraft maps fr locale to French language lock (not Arabic/English collapse)', async () => {
    vi.resetModules()
    const { __setProxyAccessTokenForTests } = await import('../security/proxyAuth')
    __setProxyAccessTokenForTests('test-user-jwt')

    const sent: Array<Record<string, unknown>> = []
    const track = {
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      muted: false,
      stop: vi.fn(),
      getSettings: () => ({ sampleRate: 48000, channelCount: 1 }),
    }
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
      clone: () => stream,
    }

    class FakeRTCPeerConnection {
      connectionState = 'new'
      iceConnectionState = 'new'
      ontrack: ((e: unknown) => void) | null = null
      oniceconnectionstatechange: (() => void) | null = null
      onconnectionstatechange: (() => void) | null = null
      private channel = {
        readyState: 'connecting' as string,
        onmessage: null as ((ev: { data: string }) => void) | null,
        onopen: null as (() => void) | null,
        onclose: null as (() => void) | null,
        onerror: null as (() => void) | null,
        send: vi.fn((raw: string) => {
          try {
            sent.push(JSON.parse(raw) as Record<string, unknown>)
          } catch {
            /* ignore */
          }
        }),
        close: vi.fn(() => {
          this.channel.readyState = 'closed'
        }),
      }
      createDataChannel() {
        queueMicrotask(() => {
          this.channel.readyState = 'open'
          this.channel.onopen?.()
        })
        return this.channel
      }
      addTrack = vi.fn()
      createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\n' }))
      setLocalDescription = vi.fn(async () => undefined)
      setRemoteDescription = vi.fn(async () => {
        this.connectionState = 'connected'
        this.iceConnectionState = 'connected'
      })
      getSenders = vi.fn(() => [{ track, replaceTrack: vi.fn(async () => undefined) }])
      getStats = vi.fn(async () => new Map())
      close = vi.fn()
    }

    const body = { appendChild: vi.fn() }
    vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection)
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        autoplay: false,
        style: { cssText: '' },
        setAttribute: vi.fn(),
        play: vi.fn(async () => undefined),
        pause: vi.fn(),
        remove: vi.fn(),
        currentTime: 0,
        srcObject: null,
        muted: false,
        volume: 1,
      })),
      body,
    })
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream),
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'v=0\r\n',
    })))

    const { createRealtimeWebRtcSession } = await import('../chat/voice/realtimeWebRtcSession')
    const session = createRealtimeWebRtcSession()
    session.setInputLanguage('fr')
    await session.connect()
    await vi.waitFor(() => expect(session.isConnected()).toBe(true))

    session.speakWrittenDraft('Bonjour, où souhaitez-vous partir ?', { locale: 'fr' })
    const createItem = sent.find((e) => e.type === 'conversation.item.create')
    const text = JSON.stringify(createItem)
    expect(text).toMatch(/speak only in French/i)
    expect(text).not.toMatch(/speak only in Arabic/i)
    expect(text).toMatch(/Bonjour/)

    // Soft disconnect must not latch hardStopped (would block later speak after reconnect).
    session.disconnect()
    expect(session.isHardStopped()).toBe(false)

    session.dispose()
    __setProxyAccessTokenForTests(undefined)
    vi.unstubAllGlobals()
  })
})

describe('pipeline — classic STT lang for French', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('classic transport sets recognition.lang to fr-FR when locale is fr', async () => {
    let capturedLang: string | null = null
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        capturedLang = this.lang
      }
      stop() {}
      abort() {}
    }
    vi.stubGlobal('window', {
      SpeechRecognition: FakeRecognition,
      webkitSpeechRecognition: FakeRecognition,
    })

    const { createClassicBilamoTransport } = await import('../bilamo/voice/classicTransport')
    const transport = createClassicBilamoTransport()
    await transport.connect()
    const ok = await transport.startListening('fr')
    expect(ok).toBe(true)
    expect(capturedLang).toBe('fr-FR')
    transport.dispose()
  })
})
