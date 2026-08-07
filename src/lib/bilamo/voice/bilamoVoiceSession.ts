/**
 * Shared Bilamo VoiceSession — single owner for Home + Conversation surfaces.
 *
 * Owns connection, mic lifecycle, transcripts, speaking/interrupt generation,
 * reconnect counters, and conversation id. UI maps session state → OrbState.
 */

import type { VoiceLocale } from '../../chat/voice/voiceTypes'
import {
  createBilamoVoiceMetrics,
  type BilamoVoiceMetrics,
  type BilamoVoiceMetricsReport,
} from './bilamoVoiceMetrics'
import { publishBilamoVoiceMetrics } from './bilamoVoiceMetricsReporter'
import { createBilamoVoiceTransport } from './createBilamoVoiceTransport'
import type {
  BilamoSpeakHandle,
  BilamoTranscriptEvent,
  BilamoVoiceConnectionState,
  BilamoVoiceTransport,
  BilamoVoiceTransportMode,
} from './bilamoVoiceTransport'

/** User-facing voice errors — never expose technical / provider details. */
const USER_SAFE_ERRORS = {
  mic: 'Microphone needs permission',
  connect: 'Could not start voice. You can type instead.',
  reconnect: 'Connection lost. You can retry or type instead.',
  device: 'Microphone disconnected. Tap to try again, or type instead.',
  unsupported: 'Voice is unavailable in this browser. You can type instead.',
} as const

/** Canonical session state machine (maps onto Orb visuals). */
export type BilamoVoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'error'

export type BilamoVoiceSessionListener = (snapshot: BilamoVoiceSessionSnapshot) => void

export type BilamoVoiceSessionSnapshot = {
  state: BilamoVoiceSessionState
  connection: BilamoVoiceConnectionState
  transportKind: BilamoVoiceTransport['kind'] | null
  partialTranscript: string
  finalTranscript: string | null
  normalizedForExtract: string | null
  generation: number
  error: string | null
  fellBackToClassic: boolean
  locale: VoiceLocale
  conversationId: string | null
  listening: boolean
  speaking: boolean
}

export type BilamoVoiceSession = {
  getSnapshot: () => BilamoVoiceSessionSnapshot
  subscribe: (listener: BilamoVoiceSessionListener) => () => void
  setConversationId: (id: string | null) => void
  setLocale: (locale: VoiceLocale) => void
  /** Mutable final-utterance sink (Home/Conversation bind via React). */
  setOnFinalUtterance: (handler: ((event: BilamoTranscriptEvent) => void) | null) => void
  prepare: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => void
  startListening: () => Promise<boolean>
  stopListening: () => void
  /** User-intent barge-in: stop playback, invalidate generation, start listening. */
  bargeIn: () => Promise<boolean>
  speak: (text: string, locale?: VoiceLocale) => BilamoSpeakHandle
  interrupt: () => void
  /** Switch to classic without tearing down conversation context. */
  switchToClassic: () => Promise<void>
  clearError: () => void
  clearTranscripts: () => void
  getMetrics: () => ReturnType<BilamoVoiceMetrics['snapshot']>
  getMetricsReport: () => BilamoVoiceMetricsReport
  /** Attach document visibility / device-loss hardening (idempotent). */
  attachReliabilityGuards: () => () => void
  dispose: () => void
}

export type CreateBilamoVoiceSessionOptions = {
  mode?: BilamoVoiceTransportMode
  locale?: VoiceLocale
  conversationId?: string | null
  createTransport?: typeof createBilamoVoiceTransport
  onFinalUtterance?: (event: BilamoTranscriptEvent) => void
}

let sharedSession: BilamoVoiceSession | null = null

export function getSharedBilamoVoiceSession(): BilamoVoiceSession | null {
  return sharedSession
}

export function resetSharedBilamoVoiceSessionForTests() {
  sharedSession?.dispose()
  sharedSession = null
}

/**
 * Returns the process-wide shared session (Home + Conversation).
 * Creates on first call.
 */
export function obtainSharedBilamoVoiceSession(
  options: CreateBilamoVoiceSessionOptions = {},
): BilamoVoiceSession {
  if (sharedSession) return sharedSession
  sharedSession = createBilamoVoiceSession(options)
  return sharedSession
}

export function createBilamoVoiceSession(
  options: CreateBilamoVoiceSessionOptions = {},
): BilamoVoiceSession {
  const metrics = createBilamoVoiceMetrics()
  const createTransport = options.createTransport ?? createBilamoVoiceTransport
  const listeners = new Set<BilamoVoiceSessionListener>()

  let transport: BilamoVoiceTransport | null = null
  let state: BilamoVoiceSessionState = 'idle'
  let connection: BilamoVoiceConnectionState = 'idle'
  let transportKind: BilamoVoiceTransport['kind'] | null = null
  let partialTranscript = ''
  let finalTranscript: string | null = null
  let normalizedForExtract: string | null = null
  let generation = 0
  let error: string | null = null
  let fellBackToClassic = false
  let locale: VoiceLocale = options.locale ?? 'en'
  let conversationId: string | null = options.conversationId ?? null
  let disposed = false
  let prepared = false
  let lastFinalKey = ''
  /** Transport speak generation currently allowed to drive speaking state. */
  let activeSpeakTransportGen = -1
  let onFinalUtterance: ((event: BilamoTranscriptEvent) => void) | null =
    options.onFinalUtterance ?? null
  let guardsAttached = false
  /** Stable snapshot reference for useSyncExternalStore (must not allocate every read). */
  let snapshot: BilamoVoiceSessionSnapshot = {
    state: 'idle',
    connection: 'idle',
    transportKind: null,
    partialTranscript: '',
    finalTranscript: null,
    normalizedForExtract: null,
    generation: 0,
    error: null,
    fellBackToClassic: false,
    locale,
    conversationId,
    listening: false,
    speaking: false,
  }

  const refreshSnapshot = () => {
    snapshot = {
      state,
      connection,
      transportKind,
      partialTranscript,
      finalTranscript,
      normalizedForExtract,
      generation,
      error,
      fellBackToClassic,
      locale,
      conversationId,
      listening: transport?.isListening() ?? false,
      speaking: transport?.isSpeaking() ?? false,
    }
  }

  const emit = () => {
    refreshSnapshot()
    for (const listener of listeners) listener(snapshot)
  }

  const setState = (next: BilamoVoiceSessionState) => {
    if (disposed) return
    if (state === next) return
    state = next
    emit()
  }

  const getSnapshot = (): BilamoVoiceSessionSnapshot => snapshot

  const wireTransport = (t: BilamoVoiceTransport) => {
    transport = t
    transportKind = t.kind
    metrics.setTransportKind(t.kind)
    t.setCallbacks({
      onPartialTranscript: (event) => {
        if (disposed) return
        partialTranscript = event.text
        metrics.mark('partial_transcript')
        if (state === 'listening' || state === 'processing') emit()
        else {
          setState('listening')
        }
      },
      onFinalTranscript: (event) => {
        if (disposed) return
        const key = event.text.trim()
        if (!key || key === lastFinalKey) return
        lastFinalKey = key
        finalTranscript = event.text
        normalizedForExtract = event.normalizedForExtract ?? null
        partialTranscript = ''
        metrics.mark('final_transcript')
        setState('processing')
        onFinalUtterance?.(event)
      },
      onSpeakingStart: (gen) => {
        if (disposed || gen !== activeSpeakTransportGen) return
        metrics.mark('speak_start')
        metrics.mark('first_audio')
        setState('speaking')
      },
      onSpeakingEnd: (gen) => {
        if (disposed || gen !== activeSpeakTransportGen) return
        activeSpeakTransportGen = -1
        metrics.mark('speak_end')
        // No auto-relisten after natural speak end — idle until user taps.
        if (state === 'speaking' || state === 'interrupted') setState('idle')
      },
      onAudioChunk: (info) => {
        if (info.generation === activeSpeakTransportGen) metrics.mark('first_audio')
      },
      onConnectionStateChange: (next) => {
        connection = next
        if (next === 'connecting') setState('connecting')
        else if (next === 'reconnecting') {
          metrics.mark('reconnect_start')
          setState('reconnecting')
        } else if (next === 'error') setState('error')
        else if (next === 'connected' && (state === 'connecting' || state === 'reconnecting')) {
          if (state === 'reconnecting') metrics.mark('reconnect_ok')
          // Reconnect must not reopen mic — return to idle.
          setState('idle')
        }
        emit()
      },
      onError: (message, detail) => {
        const code = detail?.code || ''
        if (code === 'not-allowed' || /permission/i.test(message)) {
          error = USER_SAFE_ERRORS.mic
        } else if (code === 'unsupported_browser') {
          error = USER_SAFE_ERRORS.unsupported
        } else if (code === 'device_lost' || code === 'audio_device_lost') {
          error = USER_SAFE_ERRORS.device
        } else if (code.startsWith('reconnect') || code === 'connect_failed') {
          error = USER_SAFE_ERRORS.reconnect
        } else {
          // Never surface raw provider / WebRTC strings to travelers.
          error = USER_SAFE_ERRORS.connect
        }
        setState('error')
      },
      onListeningChange: (listening) => {
        if (listening && state !== 'speaking') setState('listening')
        else if (!listening && state === 'listening') {
          emit()
        }
      },
    })
  }

  const session: BilamoVoiceSession = {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setConversationId(id) {
      conversationId = id
      emit()
    },
    setLocale(next) {
      locale = next
      emit()
    },
    setOnFinalUtterance(handler) {
      onFinalUtterance = handler
    },
    async prepare() {
      if (disposed || prepared) return
      metrics.mark('connect_start')
      const result = await createTransport({ mode: options.mode })
      fellBackToClassic = result.fellBack
      wireTransport(result.transport)
      prepared = true
      if (result.fellBack && result.reason === 'realtime_unavailable') {
        // Quiet fallback — only surface if user asked for realtime explicitly later.
      }
      emit()
    },
    async connect() {
      if (disposed) return
      if (!prepared) await session.prepare()
      metrics.mark('connect_start')
      setState('connecting')
      try {
        await transport!.connect()
        metrics.mark('connect_ok')
        error = null
        setState('idle')
      } catch {
        metrics.mark('connect_fail')
        // Auto-fallback to classic if realtime connect fails.
        if (transport?.kind === 'realtime_webrtc') {
          await session.switchToClassic()
          try {
            await transport!.connect()
            metrics.mark('connect_ok')
            error = null
            setState('idle')
            return
          } catch {
            /* fall through */
          }
        }
        error = USER_SAFE_ERRORS.connect
        setState('error')
      }
    },
    disconnect() {
      transport?.disconnect()
      setState('idle')
    },
    async startListening() {
      if (disposed) return false
      if (!prepared) await session.prepare()
      if (!transport?.isConnected()) {
        await session.connect()
      }
      // Never start listening while speaking without barge-in.
      if (transport?.isSpeaking()) {
        return session.bargeIn()
      }
      error = null
      partialTranscript = ''
      finalTranscript = null
      lastFinalKey = ''
      metrics.mark('listen_start')
      const ok = await transport!.startListening(locale)
      if (ok) {
        metrics.mark('mic_ready')
        setState('listening')
        publishBilamoVoiceMetrics(metrics.report())
      } else {
        error = USER_SAFE_ERRORS.mic
        setState('error')
      }
      return ok
    },
    stopListening() {
      transport?.stopListening()
      if (state === 'listening') setState('idle')
    },
    async bargeIn() {
      if (disposed) return false
      if (!prepared) await session.prepare()
      metrics.mark('interrupt')
      generation += 1
      activeSpeakTransportGen = -1
      transport?.interrupt()
      metrics.mark('interrupt_ack')
      setState('interrupted')
      // User intent: start listening after interrupt — not auto-relisten after reply end.
      partialTranscript = ''
      finalTranscript = null
      lastFinalKey = ''
      metrics.mark('listen_start')
      const ok = await transport!.startListening(locale)
      if (ok) {
        metrics.mark('mic_ready')
        setState('listening')
      } else {
        setState('idle')
      }
      publishBilamoVoiceMetrics(metrics.report())
      return ok
    },
    speak(text, speakLocale) {
      generation += 1
      const sessionGen = generation
      if (text.trim()) {
        metrics.mark('response_start')
        setState('speaking')
      }

      const done = (async () => {
        if (!prepared) await session.prepare()
        if (disposed || generation !== sessionGen || !transport) return
        const handle = transport.speak({
          text,
          locale: speakLocale ?? locale,
        })
        if (generation !== sessionGen) {
          transport.interrupt()
          return
        }
        activeSpeakTransportGen = handle.generation
        await handle.done
        if (
          generation === sessionGen
          && activeSpeakTransportGen === handle.generation
          && (state === 'speaking' || state === 'interrupted')
        ) {
          activeSpeakTransportGen = -1
          setState('idle')
        }
        publishBilamoVoiceMetrics(metrics.report())
      })()

      return { generation: sessionGen, done }
    },
    interrupt() {
      metrics.mark('interrupt')
      generation += 1
      activeSpeakTransportGen = -1
      transport?.interrupt()
      metrics.mark('interrupt_ack')
      if (state === 'speaking' || state === 'interrupted') setState('idle')
      publishBilamoVoiceMetrics(metrics.report())
    },
    async switchToClassic() {
      transport?.dispose()
      const result = await createTransport({ mode: 'classic', forceClassic: true })
      fellBackToClassic = true
      wireTransport(result.transport)
      prepared = true
      emit()
    },
    clearError() {
      error = null
      if (state === 'error') setState('idle')
      else emit()
    },
    clearTranscripts() {
      partialTranscript = ''
      finalTranscript = null
      normalizedForExtract = null
      lastFinalKey = ''
      emit()
    },
    getMetrics: () => metrics.snapshot(),
    getMetricsReport: () => metrics.report(),
    attachReliabilityGuards() {
      if (guardsAttached || typeof document === 'undefined') return () => {}
      guardsAttached = true

      const onVisibility = () => {
        if (!document.hidden) return
        // Background: stop capture / playback; never auto-relisten on foreground.
        if (state === 'listening') {
          transport?.stopListening()
          setState('idle')
        } else if (state === 'speaking') {
          session.interrupt()
        }
      }

      const onDeviceChange = () => {
        // Device loss while listening — surface recovery, do not auto-reopen mic.
        if (state === 'listening' || transport?.isListening()) {
          transport?.stopListening()
          error = USER_SAFE_ERRORS.device
          setState('error')
        }
      }

      document.addEventListener('visibilitychange', onVisibility)
      const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null
      md?.addEventListener?.('devicechange', onDeviceChange)

      return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        md?.removeEventListener?.('devicechange', onDeviceChange)
        guardsAttached = false
      }
    },
    dispose() {
      disposed = true
      transport?.dispose()
      transport = null
      listeners.clear()
      if (sharedSession === session) sharedSession = null
    },
  }

  return session
}

/** Orb visuals used by Bilamo UI (no redesign — maps from session FSM). */
export type BilamoOrbVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'completed'

/** Map session state → existing Orb visual states (no UI redesign). */
export function orbStateFromVoiceSession(state: BilamoVoiceSessionState): BilamoOrbVoiceState {
  switch (state) {
    case 'listening':
      return 'listening'
    case 'speaking':
      return 'speaking'
    case 'connecting':
    case 'reconnecting':
    case 'processing':
      return 'thinking'
    case 'interrupted':
      return 'listening'
    case 'error':
    case 'idle':
    default:
      return 'idle'
  }
}
