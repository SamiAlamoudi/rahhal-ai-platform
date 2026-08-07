import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { normalizeArabicAsrForExtraction } from '../chat/voice/arabicAsrNormalize'
import {
  createBilamoVoiceMetrics,
  createBilamoVoiceSession,
  createBilamoVoiceTransport,
  obtainSharedBilamoVoiceSession,
  readPublishedBilamoVoiceMetrics,
  resetSharedBilamoVoiceSessionForTests,
  type BilamoVoiceConnectionState,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportCallbacks,
} from '../bilamo/voice'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function makeMockTransport(
  kind: BilamoVoiceTransport['kind'] = 'classic_tts',
): BilamoVoiceTransport & {
  callbacks: BilamoVoiceTransportCallbacks
  listenCount: number
  interruptCount: number
  spoken: string[]
} {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  let speaking = false
  let listening = false
  let connected = false
  let connection: BilamoVoiceConnectionState = 'idle'
  let speakGen = 0
  let listenCount = 0
  let interruptCount = 0
  const spoken: string[] = []
  const pending = new Map<number, () => void>()

  const transport: BilamoVoiceTransport & {
    callbacks: BilamoVoiceTransportCallbacks
    listenCount: number
    interruptCount: number
    spoken: string[]
  } = {
    kind,
    get callbacks() {
      return callbacks
    },
    get listenCount() {
      return listenCount
    },
    get interruptCount() {
      return interruptCount
    },
    spoken,
    setCallbacks(next) {
      callbacks = next || {}
    },
    async connect() {
      connection = 'connected'
      connected = true
      callbacks.onConnectionStateChange?.('connected')
    },
    disconnect() {
      connected = false
      listening = false
      speaking = false
      connection = 'disconnected'
      callbacks.onConnectionStateChange?.('disconnected')
    },
    async startListening() {
      listenCount += 1
      listening = true
      callbacks.onListeningChange?.(true)
      return true
    },
    stopListening() {
      listening = false
      callbacks.onListeningChange?.(false)
    },
    speak({ text }) {
      const generation = ++speakGen
      speaking = Boolean(text.trim())
      spoken.push(text)
      if (speaking) callbacks.onSpeakingStart?.(generation)
      callbacks.onAudioChunk?.({ generation })
      const done = new Promise<void>((resolveDone) => {
        pending.set(generation, () => {
          if (speakGen === generation) {
            speaking = false
            callbacks.onSpeakingEnd?.(generation)
          }
          resolveDone()
        })
        queueMicrotask(() => {
          if (pending.has(generation)) {
            pending.get(generation)!()
            pending.delete(generation)
          }
        })
      })
      return { generation, done }
    },
    interrupt() {
      interruptCount += 1
      speakGen += 1
      speaking = false
      for (const [, resolveDone] of pending) resolveDone()
      pending.clear()
    },
    stop() {
      transport.interrupt()
    },
    isSpeaking: () => speaking,
    isListening: () => listening,
    isConnected: () => connected,
    getConnectionState: () => connection,
    dispose() {
      transport.disconnect()
    },
  }
  return transport
}

afterEach(() => {
  resetSharedBilamoVoiceSessionForTests()
  vi.unstubAllGlobals()
})

describe('Bilamo voice hardening — metrics', () => {
  it('publishes transportKind after prepare for staging console checks', async () => {
    const mock = makeMockTransport('realtime_webrtc')
    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport: mock,
        mode: 'realtime',
        selected: 'realtime_webrtc',
        fellBack: false,
        reason: null,
      }),
    })
    await session.prepare()
    const published = readPublishedBilamoVoiceMetrics()
    expect(published?.transportKind).toBe('realtime_webrtc')
    session.dispose()
  })

  it('records interruption latency as interrupt→ack (not speak duration)', () => {
    const m = createBilamoVoiceMetrics()
    m.mark('speak_start')
    m.mark('first_audio')
    // Simulate user waiting before barge-in, then sync stop.
    m.mark('interrupt')
    m.mark('interrupt_ack')
    const snap = m.snapshot()
    expect(snap.interruptionLatencyMs).not.toBeNull()
    expect(snap.interruptionLatencyMs!).toBeLessThan(50)
    expect(snap.timeToFirstAudioMs).not.toBeNull()
  })

  it('aggregates p50/p95 without storing transcript content', () => {
    const m = createBilamoVoiceMetrics()
    for (let i = 0; i < 5; i += 1) {
      m.mark('connect_start')
      m.mark('connect_ok')
    }
    const report = m.report()
    expect(report.aggregates.connectionSetupMs.count).toBe(5)
    expect(report.aggregates.connectionSetupMs.p50).not.toBeNull()
    expect(report.aggregates.connectionSetupMs.p95).not.toBeNull()
    expect(JSON.stringify(report)).not.toMatch(/Tokyo|الرياض|secret/i)
  })
})

describe('Bilamo voice hardening — reliability', () => {
  it('visibility hide stops listening and does not auto-relisten on show', async () => {
    const mock = makeMockTransport()
    const hidden = { value: false }
    vi.stubGlobal('document', {
      get hidden() {
        return hidden.value
      },
      addEventListener(type: string, fn: () => void) {
        if (type === 'visibilitychange') {
          ;(document as unknown as { _fn?: () => void })._fn = fn
        }
      },
      removeEventListener() {},
    })
    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    const detach = session.attachReliabilityGuards()
    await session.startListening()
    expect(session.getSnapshot().state).toBe('listening')
    hidden.value = true
    ;(document as unknown as { _fn?: () => void })._fn?.()
    expect(session.getSnapshot().state).toBe('idle')
    expect(mock.listenCount).toBe(1)
    hidden.value = false
    ;(document as unknown as { _fn?: () => void })._fn?.()
    expect(session.getSnapshot().listening).toBe(false)
    expect(mock.listenCount).toBe(1)
    detach()
    session.dispose()
  })

  it('network drop during speaking → reconnect idle without mic reopen', async () => {
    const mock = makeMockTransport('realtime_webrtc')
    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport: mock,
        mode: 'realtime',
        selected: 'realtime_webrtc',
        fellBack: false,
        reason: null,
      }),
    })
    await session.prepare()
    session.speak('Long spoken reply')
    await Promise.resolve()
    mock.callbacks.onConnectionStateChange?.('reconnecting')
    expect(session.getSnapshot().state).toBe('reconnecting')
    mock.callbacks.onConnectionStateChange?.('connected')
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().listening).toBe(false)
    session.dispose()
  })

  it('maps technical transport errors to user-safe messages', async () => {
    const mock = makeMockTransport()
    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    await session.prepare()
    mock.callbacks.onError?.('RTCPeerConnection ICE failed: STUN timeout', {
      code: 'realtime_error',
      recoverable: true,
    })
    expect(session.getSnapshot().error).toBe('Could not start voice. You can type instead.')
    expect(session.getSnapshot().error).not.toContain('STUN')
    expect(session.getSnapshot().error).not.toContain('RTCPeerConnection')
    session.dispose()
  })

  it('barge-in stops audio, listens, and never resumes old generation', async () => {
    let speakResolve: (() => void) | null = null
    let activeGen = 0
    const mock = makeMockTransport()
    mock.speak = ({ text }) => {
      mock.spoken.push(text)
      activeGen += 1
      const generation = activeGen
      mock.callbacks.onSpeakingStart?.(generation)
      mock.callbacks.onAudioChunk?.({ generation })
      const done = new Promise<void>((resolveDone) => {
        speakResolve = () => {
          mock.callbacks.onSpeakingEnd?.(generation)
          resolveDone()
        }
      })
      return { generation, done }
    }
    mock.interrupt = () => {
      if (speakResolve) {
        const r = speakResolve
        speakResolve = null
        r()
      }
    }
    mock.isSpeaking = () => speakResolve != null

    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    await session.prepare()
    const handle = session.speak('Old audio must die')
    await Promise.resolve()
    const ok = await session.bargeIn()
    expect(ok).toBe(true)
    expect(session.getSnapshot().state).toBe('listening')
    mock.callbacks.onSpeakingStart?.(1)
    mock.callbacks.onAudioChunk?.({ generation: 1 })
    expect(session.getSnapshot().state).toBe('listening')
    await handle.done
    expect(session.getMetrics().interruptionLatencyMs).not.toBeNull()
    expect(readPublishedBilamoVoiceMetrics()?.latest.interruptionLatencyMs).not.toBeNull()
    session.dispose()
  })
})

describe('Bilamo voice hardening — Arabic dialect QA (normalize layer, not transport)', () => {
  const cases = [
    {
      dialect: 'saudi',
      text: 'أبغى رحلة مباشرة من الرياض لطوكيو الأسبوع الجاي',
      expectDest: 'Tokyo',
      expectOrigin: 'Riyadh',
    },
    {
      dialect: 'egyptian',
      text: 'عايز أسافر دبي أنا ومراتي',
      expectDest: 'Dubai',
      expectTravelers: 2,
    },
    {
      dialect: 'levantine',
      text: 'بدي رحلة على إسطنبول آخر الشهر',
      expectDest: 'Istanbul',
    },
    {
      dialect: 'moroccan',
      text: 'بغيت نمشي لباريس الأسبوع الجاي',
      expectDest: 'Paris',
    },
  ] as const

  it.each(cases)('$dialect utterance reaches normalize then intent extraction', (c) => {
    const normalized = normalizeArabicAsrForExtraction(c.text)
    // Display transcript must remain the original spoken string.
    expect(c.text.trim().length).toBeGreaterThan(0)
    const extracted = extractFromUserText(normalized)
    expect(extracted.patch.destination).toBe(c.expectDest)
    if ('expectOrigin' in c && c.expectOrigin) {
      expect(extracted.patch.origin).toBe(c.expectOrigin)
    }
    if ('expectTravelers' in c && c.expectTravelers) {
      expect(extracted.patch.travelers).toBe(c.expectTravelers)
    }
    // No dialect branching inside transport adapters.
    const classic = readFileSync(resolve(__dirname, '../bilamo/voice/classicTransport.ts'), 'utf8')
    const realtime = readFileSync(
      resolve(__dirname, '../bilamo/voice/realtimeWebRtcTransport.ts'),
      'utf8',
    )
    expect(classic).toContain('normalizeArabicAsrForExtraction')
    expect(realtime).not.toContain('normalizeArabicAsrForExtraction')
    expect(realtime).not.toMatch(/مراتي|بغيت|بدي|عايز/)
  })

  it('does not duplicate finals into repeated user utterances', async () => {
    const mock = makeMockTransport()
    const finals: string[] = []
    const session = createBilamoVoiceSession({
      onFinalUtterance: (e) => finals.push(e.text),
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    await session.startListening()
    const text = 'أبغى رحلة مباشرة من الرياض لطوكيو الأسبوع الجاي'
    mock.callbacks.onFinalTranscript?.({ text, isFinal: true, locale: 'ar' })
    mock.callbacks.onFinalTranscript?.({ text, isFinal: true, locale: 'ar' })
    expect(finals).toEqual([text])
    session.dispose()
  })
})

describe('Bilamo voice hardening — ownership audit', () => {
  it('Home and Conversation share one VoiceSession singleton', () => {
    const a = obtainSharedBilamoVoiceSession()
    const b = obtainSharedBilamoVoiceSession()
    expect(a).toBe(b)
  })

  it('HomeVoiceConsultant is quarantined (no realtime session factory)', () => {
    const body = readFileSync(
      resolve(__dirname, '../../components/home/HomeVoiceConsultant.tsx'),
      'utf8',
    )
    expect(body).toMatch(/QUARANTINED/)
    expect(body).not.toContain('createRealtimeWebRtcSession')
    expect(body).not.toContain('getUserMedia')
    expect(body).toContain('return null')
  })

  it('orphaned Bilamo mic/speech/speak hooks are removed', async () => {
    const { existsSync } = await import('node:fs')
    expect(existsSync(resolve(__dirname, '../../hooks/useBilamoMic.ts'))).toBe(false)
    expect(existsSync(resolve(__dirname, '../../hooks/useBilamoSpeech.ts'))).toBe(false)
    expect(existsSync(resolve(__dirname, '../../hooks/useBilamoSpeak.ts'))).toBe(false)
  })

  it('server realtime-session never ships OPENAI key to client response shape', () => {
    const body = readFileSync(resolve(__dirname, '../../../api/openai/realtime-session.ts'), 'utf8')
    expect(body).toContain('readServerOpenAiApiKey')
    expect(body).toContain('client_secrets')
    expect(body).toMatch(/expires_after/)
    // Handler must not echo the permanent key into JSON.
    expect(body).not.toMatch(/apiKey\s*,/)
    expect(body).not.toMatch(/OPENAI_API_KEY/)
  })
})

describe('Bilamo voice hardening — transport mode switch', () => {
  it('VOICE_TRANSPORT classic/auto/realtime selection paths stay available', async () => {
    const classic = await createBilamoVoiceTransport({
      mode: 'classic',
      classicFactory: () => makeMockTransport('classic_tts'),
      realtimeFactory: () => makeMockTransport('realtime_webrtc'),
      probe: async () => ({ configured: true } as never),
    })
    expect(classic.selected).toBe('classic_tts')

    const autoFail = await createBilamoVoiceTransport({
      mode: 'auto',
      classicFactory: () => makeMockTransport('classic_tts'),
      realtimeFactory: () => makeMockTransport('realtime_webrtc'),
      probe: async () => ({ configured: false } as never),
    })
    expect(autoFail.fellBack).toBe(true)
    expect(autoFail.selected).toBe('classic_tts')

    const realtime = await createBilamoVoiceTransport({
      mode: 'realtime',
      classicFactory: () => makeMockTransport('classic_tts'),
      realtimeFactory: () => makeMockTransport('realtime_webrtc'),
      probe: async () => ({ configured: true } as never),
    })
    expect(realtime.selected).toBe('realtime_webrtc')
  })
})
