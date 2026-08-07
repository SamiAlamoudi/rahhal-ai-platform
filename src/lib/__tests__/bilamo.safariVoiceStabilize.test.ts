/**
 * P0 Safari / iPhone voice stabilization — second-turn deadlock, audible gate,
 * silent realtime → classic, watchdog idle recovery.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBilamoVoiceSession,
  createClassicBilamoTransport,
  orbStateFromVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  type BilamoVoiceConnectionState,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportCallbacks,
} from '../bilamo/voice'

vi.mock('../chat/voice/audioElementTextToSpeechProvider', () => ({
  unlockAudioPlayback: vi.fn(async () => undefined),
  preconnectOpenAiTtsRoute: vi.fn(),
}))

vi.mock('../chat/voice/voiceProviderFactory', () => ({
  createTextToSpeechProvider: () => ({
    providerId: 'mock-tts',
    isSupported: () => true,
    prefetch: vi.fn(),
    speak: vi.fn(async (opts: { onAudioPlaybackStart?: () => void }) => {
      opts.onAudioPlaybackStart?.()
    }),
    stop: vi.fn(),
    isSpeaking: () => false,
  }),
}))

function makeMockTransport(
  kind: BilamoVoiceTransport['kind'] = 'classic_tts',
  opts?: {
    /** Delay before claiming audible speaking. */
    speakDelayMs?: number
    /** Never fire onSpeakingStart (silent transport). */
    silent?: boolean
    playReject?: boolean
  },
): BilamoVoiceTransport & {
  callbacks: BilamoVoiceTransportCallbacks
  speakCount: number
  interruptCount: number
  listenCount: number
  endSpeak: (generation?: number) => void
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
  const pending = new Map<number, () => void>()

  const transport: BilamoVoiceTransport & {
    callbacks: BilamoVoiceTransportCallbacks
    speakCount: number
    interruptCount: number
    listenCount: number
    endSpeak: (generation?: number) => void
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
    endSpeak(generation) {
      const gen = generation ?? speakGen
      const resolve = pending.get(gen)
      if (resolve) {
        pending.delete(gen)
        resolve()
      }
    },
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
      const trimmed = text.trim()
      const done = new Promise<void>((resolve) => {
        pending.set(generation, () => {
          if (speakGen === generation) {
            speaking = false
            callbacks.onSpeakingEnd?.(generation)
          }
          resolve()
        })
        if (!trimmed) {
          queueMicrotask(() => {
            pending.get(generation)?.()
            pending.delete(generation)
          })
          return
        }
        if (opts?.silent || opts?.playReject) {
          queueMicrotask(() => {
            if (opts.playReject) {
              callbacks.onError?.('تعذر تشغيل الصوت. سأكمل معك بالنص الآن.', {
                code: 'playback_blocked',
                recoverable: true,
              })
            } else {
              callbacks.onSilentPlayback?.({ generation, code: 'silent_realtime_timeout' })
            }
            pending.get(generation)?.()
            pending.delete(generation)
          })
          return
        }
        const start = () => {
          if (speakGen !== generation) return
          speaking = true
          callbacks.onSpeakingStart?.(generation)
          callbacks.onAudioChunk?.({ generation })
          queueMicrotask(() => {
            if (pending.has(generation)) {
              pending.get(generation)!()
              pending.delete(generation)
            }
          })
        }
        if (opts?.speakDelayMs) {
          setTimeout(start, opts.speakDelayMs)
        } else {
          queueMicrotask(start)
        }
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
  vi.useRealTimers()
})

describe('Safari voice stabilize — session FSM', () => {
  it('returns to idle after first speak so second turn can start', async () => {
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
    const h1 = session.speak('مرحبا بك', 'ar')
    await h1.done
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().secondTurnReady).toBe(true)
    expect(orbStateFromVoiceSession(session.getSnapshot().state)).toBe('idle')

    const ok = await session.startListening()
    expect(ok).toBe(true)
    expect(session.getSnapshot().state).toBe('listening')
    session.stopListening()

    const h2 = session.speak('الخيار الثاني', 'ar')
    await h2.done
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().secondTurnReady).toBe(true)
    session.dispose()
  })

  it('supports five consecutive speak turns without reload', async () => {
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
    for (let i = 0; i < 5; i += 1) {
      const handle = session.speak(`turn ${i + 1}`, 'en')
      await handle.done
      expect(session.getSnapshot().state).toBe('idle')
      expect(session.getSnapshot().secondTurnReady).toBe(true)
      const listened = await session.startListening()
      expect(listened).toBe(true)
      session.stopListening()
    }
    expect(mock.speakCount).toBe(5)
    session.dispose()
  })

  it('interrupt while processing clears latch (second-turn deadlock root cause)', async () => {
    const mock = makeMockTransport('classic_tts', { speakDelayMs: 50 })
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
    session.speak('slow speak', 'en')
    // Force processing without waiting for audible start.
    expect(['processing', 'speaking', 'idle']).toContain(session.getSnapshot().state)
    session.interrupt()
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().secondTurnReady).toBe(true)
    expect(orbStateFromVoiceSession('processing')).toBe('thinking')
    // After interrupt, orb mapping for idle is tappable.
    expect(orbStateFromVoiceSession(session.getSnapshot().state)).toBe('idle')
    const ok = await session.startListening()
    expect(ok).toBe(true)
    session.dispose()
  })

  it('play() rejection surfaces playback error and returns idle (not stuck speaking)', async () => {
    const mock = makeMockTransport('classic_tts', { playReject: true })
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
    const handle = session.speak('blocked', 'ar')
    await handle.done
    await new Promise((r) => setTimeout(r, 20))
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().error).toMatch(/تشغيل الصوت/)
    expect(session.getSnapshot().lastSafeErrorCode).toBe('playback_blocked')
    expect(session.getSnapshot().secondTurnReady).toBe(true)
    session.dispose()
  })

  it('barge-in while speaking returns to listening for the new turn', async () => {
    let callbacks: BilamoVoiceTransportCallbacks = {}
    let speaking = false
    let listening = false
    let connected = false
    let connection: BilamoVoiceConnectionState = 'idle'
    let speakGen = 0
    let interruptCount = 0
    const held: BilamoVoiceTransport = {
      kind: 'classic_tts',
      setCallbacks(next) {
        callbacks = next || {}
      },
      async connect() {
        connected = true
        connection = 'connected'
        callbacks.onConnectionStateChange?.('connected')
      },
      disconnect() {
        connected = false
        connection = 'disconnected'
      },
      async startListening() {
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
        if (speaking) {
          queueMicrotask(() => {
            callbacks.onSpeakingStart?.(generation)
            callbacks.onAudioChunk?.({ generation })
          })
        }
        // Hang until interrupt — models long assistant audio.
        return {
          generation,
          done: new Promise<void>(() => {
            /* held until interrupt bumps generation */
          }),
        }
      },
      interrupt() {
        interruptCount += 1
        speakGen += 1
        speaking = false
        callbacks.onSpeakingEnd?.(speakGen - 1)
      },
      stop() {
        held.interrupt()
      },
      isSpeaking: () => speaking,
      isListening: () => listening,
      isConnected: () => connected,
      getConnectionState: () => connection,
      dispose() {
        held.disconnect()
      },
    }

    const session = createBilamoVoiceSession({
      mode: 'classic',
      createTransport: async () => ({
        transport: held,
        mode: 'classic',
        selected: 'classic_tts',
        fellBack: false,
        reason: null,
      }),
    })
    await session.connect()
    session.speak('long reply', 'en')
    await new Promise((r) => setTimeout(r, 10))
    expect(session.getSnapshot().state).toBe('speaking')
    const ok = await session.bargeIn()
    expect(ok).toBe(true)
    expect(session.getSnapshot().state).toBe('listening')
    expect(interruptCount).toBeGreaterThan(0)
    session.dispose()
  })

  it('watchdog recovers stuck processing to idle without auto-listen', async () => {
    vi.useFakeTimers()
    const mock = makeMockTransport()
    // Swallow speaking end so finishSpeak cannot idle — simulate desync.
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
    // Emit final transcript → processing, then never speak.
    mock.callbacks.onFinalTranscript?.({ text: 'أريد اليابان', isFinal: true })
    expect(session.getSnapshot().state).toBe('processing')
    await vi.advanceTimersByTimeAsync(8_500)
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().listening).toBe(false)
    expect(session.getSnapshot().secondTurnReady).toBe(true)
    session.dispose()
  })

  it('stale generation cannot reclaim speaking state', async () => {
    const mock = makeMockTransport('classic_tts', { speakDelayMs: 30 })
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
    const first = session.speak('first', 'en')
    session.interrupt()
    // Stale start from first generation must be ignored.
    mock.callbacks.onSpeakingStart?.(first.generation)
    expect(session.getSnapshot().state).not.toBe('speaking')
    await session.startListening()
    expect(session.getSnapshot().state).toBe('listening')
    session.dispose()
  })

  it('orb maps terminal states to idle (never permanent thinking)', () => {
    expect(orbStateFromVoiceSession('idle')).toBe('idle')
    expect(orbStateFromVoiceSession('error')).toBe('idle')
    expect(orbStateFromVoiceSession('speaking')).toBe('speaking')
    expect(orbStateFromVoiceSession('listening')).toBe('listening')
    expect(orbStateFromVoiceSession('processing')).toBe('thinking')
  })

  it('does not expose OpenAI secrets in safari stabilize modules', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(import.meta.dirname, '../bilamo/voice')
    for (const name of [
      'bilamoVoiceSession.ts',
      'classicTransport.ts',
      'realtimeWebRtcTransport.ts',
      'voicePlaybackDiagnostics.ts',
    ]) {
      const body = fs.readFileSync(path.join(root, name), 'utf8')
      expect(body).not.toMatch(/VITE_OPENAI_API_KEY/)
      expect(body).not.toMatch(/sk-proj-|sk-[a-zA-Z0-9]{20,}/)
    }
  })
})

describe('classic audible gate', () => {
  it('does not claim speaking before playback start callback', async () => {
    const events: string[] = []
    const transport = createClassicBilamoTransport()
    transport.setCallbacks({
      onSpeakingStart: () => events.push('start'),
      onSpeakingEnd: () => events.push('end'),
    })
    await transport.connect()
    expect(transport.isSpeaking()).toBe(false)
    const handle = transport.speak({ text: 'hello', locale: 'en' })
    expect(transport.isSpeaking()).toBe(false)
    await handle.done
    expect(events).toEqual(['start', 'end'])
  })
})
