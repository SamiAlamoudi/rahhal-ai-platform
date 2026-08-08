import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeArabicAsrForExtraction } from '../chat/voice/arabicAsrNormalize'
import {
  createBilamoVoiceSession,
  createBilamoVoiceTransport,
  obtainSharedBilamoVoiceSession,
  orbStateFromVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  resolveVoiceTransportMode,
  type BilamoTranscriptEvent,
  type BilamoVoiceConnectionState,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportCallbacks,
} from '../bilamo/voice'

function makeMockTransport(
  kind: BilamoVoiceTransport['kind'] = 'classic_tts',
): BilamoVoiceTransport & {
  callbacks: BilamoVoiceTransportCallbacks
  speakCount: number
  interruptCount: number
  listenCount: number
  spoken: string[]
} {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  let speaking = false
  let listening = false
  let connected = false
  let connection: BilamoVoiceConnectionState = 'idle'
  let speakGen = 0
  let speakCount = 0
  let interruptCount = 0
  let listenCount = 0
  const spoken: string[] = []
  const pending = new Map<number, () => void>()

  const transport: BilamoVoiceTransport & {
    callbacks: BilamoVoiceTransportCallbacks
    speakCount: number
    interruptCount: number
    listenCount: number
    spoken: string[]
  } = {
    kind,
    get callbacks() {
      return callbacks
    },
    get speakCount() {
      return speakCount
    },
    get interruptCount() {
      return interruptCount
    },
    get listenCount() {
      return listenCount
    },
    spoken,
    setCallbacks(next) {
      callbacks = next || {}
    },
    async connect() {
      connection = 'connecting'
      callbacks.onConnectionStateChange?.('connecting')
      connected = true
      connection = 'connected'
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
      speakCount += 1
      const generation = ++speakGen
      speaking = Boolean(text.trim())
      if (speaking) callbacks.onSpeakingStart?.(generation)
      callbacks.onAudioChunk?.({ generation })
      spoken.push(text)
      const done = new Promise<void>((resolve) => {
        pending.set(generation, () => {
          if (speakGen === generation) {
            speaking = false
            callbacks.onSpeakingEnd?.(generation)
          }
          resolve()
        })
        // Auto-complete shortly unless interrupted.
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
      for (const [, resolve] of pending) resolve()
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
      connection = 'idle'
    },
  }
  return transport
}

afterEach(() => {
  resetSharedBilamoVoiceSessionForTests()
})

describe('voice transport mode resolution', () => {
  it('maps VOICE_TRANSPORT values', () => {
    expect(resolveVoiceTransportMode('realtime')).toBe('realtime')
    expect(resolveVoiceTransportMode('classic')).toBe('classic')
    expect(resolveVoiceTransportMode('auto')).toBe('auto')
    expect(resolveVoiceTransportMode('tts')).toBe('classic')
    expect(resolveVoiceTransportMode(undefined)).toBe('auto')
  })
})

describe('createBilamoVoiceTransport selection + auto fallback', () => {
  it('selects classic when mode is classic', async () => {
    const classic = makeMockTransport('classic_tts')
    const result = await createBilamoVoiceTransport({
      mode: 'classic',
      classicFactory: () => classic,
      realtimeFactory: () => makeMockTransport('realtime_webrtc'),
      probe: async () => ({ configured: true } as never),
    })
    expect(result.selected).toBe('classic_tts')
    expect(result.fellBack).toBe(false)
  })

  it('falls back to classic when realtime unavailable (auto)', async () => {
    const classic = makeMockTransport('classic_tts')
    const result = await createBilamoVoiceTransport({
      mode: 'auto',
      classicFactory: () => classic,
      realtimeFactory: () => makeMockTransport('realtime_webrtc'),
      probe: async () => ({ configured: false } as never),
    })
    expect(result.selected).toBe('classic_tts')
    expect(result.fellBack).toBe(true)
    expect(result.reason).toBe('auto_classic_fallback')
  })

  it('falls back when realtime mode cannot probe', async () => {
    const result = await createBilamoVoiceTransport({
      mode: 'realtime',
      classicFactory: () => makeMockTransport('classic_tts'),
      realtimeFactory: () => makeMockTransport('realtime_webrtc'),
      probe: async () => {
        throw new Error('network')
      },
    })
    expect(result.selected).toBe('classic_tts')
    expect(result.fellBack).toBe(true)
  })

  it('selects realtime when probe says configured', async () => {
    const realtime = makeMockTransport('realtime_webrtc')
    const result = await createBilamoVoiceTransport({
      mode: 'auto',
      classicFactory: () => makeMockTransport('classic_tts'),
      realtimeFactory: () => realtime,
      probe: async () => ({ configured: true } as never),
    })
    expect(result.selected).toBe('realtime_webrtc')
    expect(result.fellBack).toBe(false)
  })
})

describe('BilamoVoiceSession', () => {
  it('connect / disconnect lifecycle', async () => {
    const mock = makeMockTransport()
    const session = createBilamoVoiceSession({
      mode: 'classic',
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    await session.connect()
    expect(session.getSnapshot().connection).toBe('connected')
    expect(session.getSnapshot().state).toBe('idle')
    session.disconnect()
    expect(session.getSnapshot().connection).toBe('disconnected')
    session.dispose()
  })

  it('permission denied surfaces recoverable error', async () => {
    const mock = makeMockTransport()
    mock.startListening = async () => {
      mock.callbacks.onError?.('Microphone needs permission', {
        code: 'not-allowed',
        recoverable: true,
      })
      return false
    }
    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    const ok = await session.startListening()
    expect(ok).toBe(false)
    expect(session.getSnapshot().state).toBe('error')
    expect(session.getSnapshot().error).toMatch(/Microphone/i)
    session.dispose()
  })

  it('partial and final transcripts update session without duplicates', async () => {
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
    mock.callbacks.onPartialTranscript?.({ text: 'hello', isFinal: false })
    expect(session.getSnapshot().partialTranscript).toBe('hello')
    mock.callbacks.onFinalTranscript?.({ text: 'hello tokyo', isFinal: true })
    mock.callbacks.onFinalTranscript?.({ text: 'hello tokyo', isFinal: true })
    expect(finals).toEqual(['hello tokyo'])
    expect(session.getSnapshot().finalTranscript).toBe('hello tokyo')
    session.dispose()
  })

  it('speaking state reflects streamed audio and clears on end', async () => {
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
    const handle = session.speak('Welcome to Bilamo')
    expect(session.getSnapshot().state).toBe('speaking')
    await handle.done
    expect(session.getSnapshot().state).toBe('idle')
    expect(orbStateFromVoiceSession(session.getSnapshot().state)).toBe('idle')
    session.dispose()
  })

  it('barge-in interrupts playback, starts listening, invalidates stale generation', async () => {
    let speakResolve: (() => void) | null = null
    let activeGen = 0
    const mock = makeMockTransport()
    mock.speak = ({ text }) => {
      mock.spoken.push(text)
      activeGen += 1
      const generation = activeGen
      mock.callbacks.onSpeakingStart?.(generation)
      mock.callbacks.onAudioChunk?.({ generation })
      const done = new Promise<void>((resolve) => {
        speakResolve = () => {
          mock.callbacks.onSpeakingEnd?.(generation)
          resolve()
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
    const handle = session.speak('Long reply about Japan')
    // Allow async prepare+speak path to arm activeSpeakTransportGen.
    await Promise.resolve()
    expect(session.getSnapshot().state).toBe('speaking')
    const genBefore = session.getSnapshot().generation
    const ok = await session.bargeIn()
    expect(ok).toBe(true)
    expect(session.getSnapshot().generation).toBeGreaterThan(genBefore)
    expect(session.getSnapshot().state).toBe('listening')
    expect(mock.listenCount).toBe(1)
    // Stale speaking-start from old audio must not reclaim orb.
    mock.callbacks.onSpeakingStart?.(1)
    expect(session.getSnapshot().state).toBe('listening')
    await handle.done
    expect(session.getSnapshot().state).toBe('listening')
    session.dispose()
  })

  it('ignores stale generation speaking events after interrupt', async () => {
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
    const handle = session.speak('Stale')
    const staleGen = handle.generation
    session.interrupt()
    mock.callbacks.onSpeakingStart?.(staleGen)
    mock.callbacks.onSpeakingEnd?.(staleGen)
    expect(session.getSnapshot().state).not.toBe('speaking')
    session.dispose()
  })

  it('reconnect does not auto-reopen microphone', async () => {
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
    await session.connect()
    await session.startListening()
    expect(session.getSnapshot().listening).toBe(true)
    session.stopListening()
    mock.callbacks.onConnectionStateChange?.('reconnecting')
    expect(session.getSnapshot().state).toBe('reconnecting')
    mock.callbacks.onConnectionStateChange?.('connected')
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().listening).toBe(false)
    expect(mock.listenCount).toBe(1)
    session.dispose()
  })

  it('speak completion does not auto-relisten', async () => {
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
    await session.speak('Done').done
    expect(session.getSnapshot().state).toBe('idle')
    expect(mock.listenCount).toBe(0)
    session.dispose()
  })

  it('does not overlap duplicate playback ownership', async () => {
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
    const a = session.speak('First')
    const b = session.speak('Second')
    expect(b.generation).toBeGreaterThan(a.generation)
    await Promise.all([a.done, b.done])
    expect(mock.spoken.at(-1)).toMatch(/Second/)
    session.dispose()
  })

  it('Home and Conversation share one VoiceSession', () => {
    const a = obtainSharedBilamoVoiceSession()
    const b = obtainSharedBilamoVoiceSession()
    expect(a).toBe(b)
    a.setConversationId('conv-shared')
    expect(b.getSnapshot().conversationId).toBe('conv-shared')
  })

  it('Arabic transcript reaches normalization layer (not inside transport dialect logic)', async () => {
    const mock = makeMockTransport()
    const finals: BilamoTranscriptEvent[] = []
    const session = createBilamoVoiceSession({
      onFinalUtterance: (e) => {
        finals.push(e)
      },
      createTransport: async () => ({
        transport: mock,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    await session.startListening()
    const raw = 'ثلاثة أغسطس إلى دبي'
    const normalized = normalizeArabicAsrForExtraction(raw)
    mock.callbacks.onFinalTranscript?.({
      text: raw,
      isFinal: true,
      normalizedForExtract: normalized !== raw ? normalized : undefined,
      locale: 'ar',
    })
    expect(finals[0]?.text).toBe(raw)
    expect(session.getSnapshot().normalizedForExtract).toBeTruthy()
    expect(normalizeArabicAsrForExtraction(raw)).toMatch(/3/)
    session.dispose()
  })

  it('records lightweight performance metrics without transcript content', async () => {
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
    await session.connect()
    await session.startListening()
    mock.callbacks.onPartialTranscript?.({ text: 'secret destination', isFinal: false })
    mock.callbacks.onFinalTranscript?.({ text: 'secret destination', isFinal: true })
    await session.speak('reply').done
    const metrics = session.getMetrics()
    const blob = JSON.stringify(metrics)
    expect(blob).not.toMatch(/secret destination/)
    expect(metrics.marks).toBeGreaterThan(0)
    expect(metrics.connectionSetupMs).not.toBeNull()
    session.dispose()
  })

  it('client transport surface exposes no API secrets', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const body = readFileSync(
      resolve(__dirname, '../bilamo/voice/realtimeWebRtcTransport.ts'),
      'utf8',
    )
    expect(body).not.toMatch(/sk-[a-zA-Z0-9]/)
    expect(body).not.toMatch(/OPENAI_API_KEY/)
    expect(body).toMatch(/createRealtimeWebRtcSession/)
  })
})

describe('classic transport Arabic normalize on final', () => {
  it('emits normalizedForExtract for Arabic finals', async () => {
    vi.stubGlobal('window', globalThis)
    class FakeRec {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        this.onresult?.({
          resultIndex: 0,
          results: [
            Object.assign([{ transcript: 'ثلاثة أغسطس' }], { isFinal: true }),
          ],
        })
      }
      stop() {
        this.onend?.()
      }
      abort() {
        this.onend?.()
      }
    }
    ;(globalThis as unknown as { window: unknown }).window = globalThis
    ;(globalThis as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRec
    Object.defineProperty(globalThis, 'window', {
      value: {
        SpeechRecognition: FakeRec,
        webkitSpeechRecognition: FakeRec,
      },
      configurable: true,
    })

    const { createClassicBilamoTransport } = await import('../bilamo/voice/classicTransport')
    const t = createClassicBilamoTransport()
    const finals: BilamoTranscriptEvent[] = []
    t.setCallbacks({
      onFinalTranscript: (e) => {
        finals.push(e)
      },
    })
    await t.connect()
    await t.startListening('ar')
    t.stopListening()
    expect(finals[0]?.text).toBe('ثلاثة أغسطس')
    expect(finals[0]?.normalizedForExtract).toBeTruthy()
    t.dispose()
  })
})
