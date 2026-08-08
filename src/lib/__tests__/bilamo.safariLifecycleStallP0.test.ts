/**
 * P0 Safari lifecycle: capability/session HTTP 200 must not leave the client idle
 * with no mic / no peer / no classic fallback (physical iPhone failure mode).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBilamoVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  type BilamoVoiceConnectOptions,
  type BilamoVoiceConnectionState,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportCallbacks,
} from '../bilamo/voice'
import {
  __resetVoiceHttpTraceForTests,
  getVoiceHttpTrace,
  noteVoiceHttpResult,
  noteVoiceLifecycleStage,
  noteVoiceRequestDispatched,
} from '../bilamo/voice/voiceHttpTrace'

vi.mock('../chat/voice/audioElementTextToSpeechProvider', () => ({
  unlockAudioPlayback: vi.fn(async () => undefined),
  preconnectOpenAiTtsRoute: vi.fn(),
  isAudioPlaybackUnlocked: vi.fn(() => true),
  resumeSharedAudioContext: vi.fn(async () => undefined),
}))

function makeLiveMicStream(): MediaStream {
  const track = {
    kind: 'audio',
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(),
    contentHint: '',
  }
  return {
    getAudioTracks: () => [track as unknown as MediaStreamTrack],
    getTracks: () => [track as unknown as MediaStreamTrack],
    active: true,
  } as unknown as MediaStream
}

function makeStallingRealtimeTransport(): BilamoVoiceTransport & {
  connectCalls: number
  listenCalls: number
  lastConnectOptions: BilamoVoiceConnectOptions | undefined
} {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  let connection: BilamoVoiceConnectionState = 'idle'
  let connectCalls = 0
  let listenCalls = 0
  let lastConnectOptions: BilamoVoiceConnectOptions | undefined

  const transport: BilamoVoiceTransport & {
    connectCalls: number
    listenCalls: number
    lastConnectOptions: BilamoVoiceConnectOptions | undefined
  } = {
    kind: 'realtime_webrtc',
    get connectCalls() {
      return connectCalls
    },
    get listenCalls() {
      return listenCalls
    },
    get lastConnectOptions() {
      return lastConnectOptions
    },
    setCallbacks(next) {
      callbacks = next || {}
    },
    async connect(options) {
      connectCalls += 1
      lastConnectOptions = options
      // Reproduce physical evidence: capability/session already "accepted" in HTTP trace,
      // but peer/mic never establish — connect appears to succeed without WebRTC.
      connection = 'connected'
      callbacks.onConnectionStateChange?.('connected')
      noteVoiceLifecycleStage('VOICE_REQUEST_ACCEPTED')
    },
    disconnect() {
      connection = 'disconnected'
      callbacks.onConnectionStateChange?.('disconnected')
    },
    async startListening(_locale, options) {
      listenCalls += 1
      lastConnectOptions = options ?? lastConnectOptions
      // Stall: never arm mic / listening despite accepted request.
      callbacks.onListeningChange?.(false)
      return false
    },
    stopListening() {
      callbacks.onListeningChange?.(false)
    },
    cancelListening() {
      callbacks.onListeningChange?.(false)
    },
    finalizeListening() {},
    speak() {
      return { generation: 1, done: Promise.resolve() }
    },
    interrupt() {},
    stop() {},
    isSpeaking: () => false,
    isListening: () => false,
    isConnected: () => connection === 'connected',
    getConnectionState: () => connection,
    dispose() {},
  }
  return transport
}

describe('Safari lifecycle stall P0 — HTTP 200 + idle/no mic/no peer', () => {
  beforeEach(() => {
    __resetVoiceHttpTraceForTests()
    resetSharedBilamoVoiceSessionForTests()
    vi.stubGlobal(
      'navigator',
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => makeLiveMicStream()),
        },
      } as unknown as Navigator,
    )
  })

  afterEach(() => {
    resetSharedBilamoVoiceSessionForTests()
    __resetVoiceHttpTraceForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('capability probe 200 must NOT look like a live realtime session', () => {
    noteVoiceRequestDispatched('/api/openai/realtime-session')
    noteVoiceHttpResult({
      route: '/api/openai/realtime-session',
      status: 200,
      kind: 'realtime_capability',
    })
    const t = getVoiceHttpTrace()
    expect(t.lastEvent).toBe('REALTIME_CAPABILITY_OK')
    expect(t.realtimeSessionCreated).not.toBe(true)
    expect(t.httpRoute).toBe('/api/openai/realtime-session')
    expect(t.httpStatus).toBe(200)
  })

  it('VOICE_REQUEST_ACCEPTED must not leave FSM idle without mic/peer — emits LIFECYCLE_STALL', async () => {
    const stall = makeStallingRealtimeTransport()
    const classicListen = vi.fn(async () => true)
    const session = createBilamoVoiceSession({
      createTransport: async ({ mode, forceClassic } = {}) => {
        if (forceClassic || mode === 'classic') {
          return {
            transport: {
              kind: 'classic_tts' as const,
              setCallbacks() {},
              async connect() {},
              disconnect() {},
              startListening: classicListen,
              stopListening() {},
              cancelListening() {},
              finalizeListening() {},
              speak() {
                return { generation: 1, done: Promise.resolve() }
              },
              interrupt() {},
              stop() {},
              isSpeaking: () => false,
              isListening: () => false,
              isConnected: () => true,
              getConnectionState: () => 'connected' as const,
              dispose() {},
            },
            mode: 'classic' as const,
            selected: 'classic_tts' as const,
            fellBack: true,
            reason: 'lifecycle_stall',
          }
        }
        return {
          transport: stall,
          mode: 'realtime' as const,
          selected: 'realtime_webrtc' as const,
          fellBack: false,
          reason: null,
        }
      },
    })

    // Reproduce: prepare/capability already green before gesture arming.
    noteVoiceRequestDispatched('/api/openai/realtime-session')
    noteVoiceHttpResult({
      route: '/api/openai/realtime-session',
      status: 200,
      kind: 'realtime_capability',
    })

    session.setContinuousListening(true)
    const ok = await session.startListening({ localStream: makeLiveMicStream() })

    expect(stall.connectCalls).toBeGreaterThan(0)
    expect(stall.listenCalls).toBeGreaterThan(0)
    expect(stall.lastConnectOptions?.localStream).toBeTruthy()

    const snap = session.getSnapshot()
    // Must not remain silently idle after accepted — listening via classic, or explicit error.
    expect(snap.state).not.toBe('idle')
    if (!ok) {
      expect(getVoiceHttpTrace().lastEvent).toMatch(/LIFECYCLE_STALL|VOICE_OUTPUT_FAILED|MIC_/)
      expect(snap.lastSafeErrorCode || snap.playback.lastSafeErrorCode).toBeTruthy()
    } else {
      // Classic fallback path after realtime listen stall.
      expect(classicListen).toHaveBeenCalled()
      expect(snap.state).toBe('listening')
      expect(snap.fellBackToClassic || snap.transportKind === 'classic_tts').toBe(true)
    }
  })

  it('startListening captures mic before transport connect (gesture path)', async () => {
    const getUserMedia = vi.fn(async () => makeLiveMicStream())
    vi.stubGlobal(
      'navigator',
      { mediaDevices: { getUserMedia } } as unknown as Navigator,
    )

    let connectSawStream = false
    const transport: BilamoVoiceTransport = {
      kind: 'realtime_webrtc',
      setCallbacks() {},
      async connect(options) {
        connectSawStream = Boolean(
          options?.localStream?.getAudioTracks?.().some((t) => t.readyState === 'live'),
        )
      },
      disconnect() {},
      async startListening(_locale, options) {
        return Boolean(
          options?.localStream?.getAudioTracks?.().some((t) => t.readyState === 'live')
          || connectSawStream,
        )
      },
      stopListening() {},
      speak() {
        return { generation: 1, done: Promise.resolve() }
      },
      interrupt() {},
      stop() {},
      isSpeaking: () => false,
      isListening: () => false,
      isConnected: () => false,
      getConnectionState: () => 'idle',
      dispose() {},
    }

    const session = createBilamoVoiceSession({
      createTransport: async () => ({
        transport,
        mode: 'realtime',
        selected: 'realtime_webrtc',
        fellBack: false,
        reason: null,
      }),
    })

    // No pre-captured stream — session must call getUserMedia before prepare/connect awaits.
    const ok = await session.startListening()
    expect(getUserMedia).toHaveBeenCalled()
    expect(ok).toBe(true)
    expect(session.getSnapshot().state).toBe('listening')
    expect(session.getSnapshot().playback.mediaStreamActive).toBe(true)
  })
})
