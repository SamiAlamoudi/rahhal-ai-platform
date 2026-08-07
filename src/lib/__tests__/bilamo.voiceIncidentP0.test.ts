/**
 * P0 incident regressions: CORS-safe auth path, turn diagnostics, send queue, EOS interim.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createArabicUtteranceAssembler } from '../chat/voice/arabicUtteranceAssembler'
import {
  createBilamoVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  type BilamoVoiceConnectionState,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportCallbacks,
} from '../bilamo/voice'
import {
  __resetVoiceHttpTraceForTests,
  beginVoiceTurnCorrelation,
  getVoiceHttpTrace,
  noteVoiceDiscardReason,
  noteVoiceHttpResult,
  noteVoiceRequestDispatched,
  noteVoiceTurnStage,
} from '../bilamo/voice/voiceHttpTrace'
import { isAllowedVercelPreviewOrigin } from '../../../api/_lib/edgeGuard'
import { safeHttpErrorCode } from '../bilamo/voice/voicePlaybackDiagnostics'

vi.mock('../chat/voice/audioElementTextToSpeechProvider', () => ({
  unlockAudioPlayback: vi.fn(async () => undefined),
  preconnectOpenAiTtsRoute: vi.fn(),
}))

afterEach(() => {
  resetSharedBilamoVoiceSessionForTests()
  __resetVoiceHttpTraceForTests()
})

function makeMockTransport(opts?: {
  failFirstListen?: boolean
  pendingFinal?: string
}): BilamoVoiceTransport {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  let speaking = false
  let listening = false
  let connected = false
  let connection: BilamoVoiceConnectionState = 'idle'
  let speakGen = 0
  let listenCount = 0

  return {
    kind: 'classic_tts',
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
      if (opts?.failFirstListen && listenCount === 1) return false
      listening = true
      callbacks.onListeningChange?.(true)
      return true
    },
    stopListening() {
      listening = false
      callbacks.onListeningChange?.(false)
    },
    finalizeListening() {
      listening = false
      callbacks.onListeningChange?.(false)
      const text = (opts?.pendingFinal || 'مرحبا بيلامو').trim()
      if (text) callbacks.onFinalTranscript?.({ text, isFinal: true })
    },
    speak({ text }) {
      const generation = ++speakGen
      const trimmed = text.trim()
      const done = new Promise<void>((resolve) => {
        if (!trimmed) {
          queueMicrotask(resolve)
          return
        }
        speaking = true
        queueMicrotask(() => {
          callbacks.onSpeakingStart?.(generation)
          speaking = false
          callbacks.onSpeakingEnd?.(generation)
          resolve()
        })
      })
      return { generation, done }
    },
    interrupt() {
      speaking = false
      listening = false
    },
    stop() {
      speaking = false
      listening = false
    },
    isListening: () => listening,
    isSpeaking: () => speaking,
    isConnected: () => connected,
    getConnectionState: () => connection,
    dispose() {},
  }
}

function transportFactory(transport: BilamoVoiceTransport) {
  return async () => ({
    transport,
    mode: 'classic' as const,
    selected: 'classic_tts' as const,
    fellBack: false,
    reason: null,
  })
}

describe('P0 Preview CORS', () => {
  it('allows git-branch Preview origin used by PR deployments', () => {
    const prod = 'https://rahhal-ai-platform.vercel.app'
    const prodHost = new URL(prod).hostname
    const prodBase = prodHost.replace(/\.vercel\.app$/, '')
    const projectBase = prodBase.replace(/platform$/, 'project')
    const preview = `https://${prodBase}-git-cursor-bilamo-s-3bb9d3-${projectBase}.vercel.app`
    expect(isAllowedVercelPreviewOrigin(preview)).toBe(true)
  })
})

describe('voice HTTP / correlation diagnostics', () => {
  it('keeps one correlation id across request stages', () => {
    const id = beginVoiceTurnCorrelation()
    noteVoiceTurnStage('finalizing')
    noteVoiceRequestDispatched('/api/openai/realtime-call')
    noteVoiceHttpResult({
      route: '/api/openai/realtime-call',
      status: 200,
      kind: 'realtime',
    })
    const t = getVoiceHttpTrace()
    expect(t.correlationId).toBe(id)
    expect(t.requestDispatched).toBe(true)
    expect(t.httpStatus).toBe(200)
    expect(t.realtimeSessionCreated).toBe(true)
  })

  it('maps AUTH_INVALID / CORS codes safely', () => {
    expect(safeHttpErrorCode(401, 'AUTH_INVALID')).toBe('AUTH_INVALID')
    expect(safeHttpErrorCode(403, 'CORS_ORIGIN_DENIED')).toBe('CORS_ORIGIN_DENIED')
    expect(safeHttpErrorCode(401, 'sk-leak')).toBe('HTTP_401')
  })

  it('records queued_while_busy discard without user content', () => {
    beginVoiceTurnCorrelation()
    noteVoiceDiscardReason('queued_while_busy')
    expect(getVoiceHttpTrace().discardReason).toBe('queued_while_busy')
    noteVoiceDiscardReason('DROP THIS SECRET jwt')
    expect(getVoiceHttpTrace().discardReason).toBe('queued_while_busy')
  })
})

describe('session turn stages + error→idle', () => {
  it('startListening → finalizeListening advances turn stages and recovers to idle after speak', async () => {
    const finals: string[] = []
    const session = createBilamoVoiceSession({
      createTransport: transportFactory(makeMockTransport()),
      onFinalUtterance: (e) => finals.push(e.text),
    })
    await session.prepare()
    await session.connect()
    const ok = await session.startListening()
    expect(ok).toBe(true)
    expect(session.getSnapshot().playback.correlationId).toBeTruthy()
    expect(session.getSnapshot().playback.turnStage).toBe('listening')

    session.finalizeListening()
    expect(finals).toHaveLength(1)
    expect(session.getSnapshot().playback.endOfSpeechDetected).toBe(true)
    expect(session.getSnapshot().playback.finalTranscriptReceived).toBe(true)

    const handle = session.speak('أهلاً')
    await handle.done
    expect(session.getSnapshot().playback.audioPlaybackStarted).toBe(true)
    expect(session.getSnapshot().state).toBe('idle')
    expect(session.getSnapshot().secondTurnReady).toBe(true)
  })

  it('error path returns to idle and allows a second turn', async () => {
    const session = createBilamoVoiceSession({
      createTransport: transportFactory(makeMockTransport({ failFirstListen: true })),
    })
    await session.prepare()
    const first = await session.startListening()
    expect(first).toBe(false)
    expect(session.getSnapshot().state).toBe('error')
    await new Promise((r) => setTimeout(r, 100))
    expect(session.getSnapshot().state).toBe('idle')
    session.clearError()
    const second = await session.startListening()
    expect(second).toBe(true)
    expect(session.getSnapshot().state).toBe('listening')
  })

  it('five consecutive successful turns stay single-submit', async () => {
    const finals: string[] = []
    const session = createBilamoVoiceSession({
      createTransport: transportFactory(makeMockTransport({ pendingFinal: 'مرحبا' })),
      onFinalUtterance: (e) => finals.push(e.text),
    })
    await session.prepare()
    for (let i = 0; i < 5; i += 1) {
      await session.startListening()
      session.finalizeListening()
      session.finalizeListening()
      const handle = session.speak(`رد ${i}`)
      await handle.done
      expect(session.getSnapshot().state).toBe('idle')
    }
    expect(finals).toHaveLength(5)
  })
})

describe('EOS interim finalize', () => {
  it('forceCommitNow finalizes best interim when no final event arrives', () => {
    const commits: string[] = []
    const assembler = createArabicUtteranceAssembler({
      conversationLanguage: () => 'ar',
      nowMs: () => 3000,
      onCommit: (r) => commits.push(r.committedTranscript),
      onReject: () => undefined,
    })
    assembler.onSpeechStarted(0)
    assembler.onInterim('أبغى أسافر اليابان')
    assembler.forceCommitNow()
    expect(commits).toHaveLength(1)
    expect(commits[0]).toContain('اليابان')
    assembler.forceCommitNow()
    expect(commits).toHaveLength(1)
  })
})
