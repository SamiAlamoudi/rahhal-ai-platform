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
import {
  emptyVoicePlaybackDiagnostics,
  readAudioContextState,
  type VoicePlaybackDiagnostics,
} from './voicePlaybackDiagnostics'

/** Stuck processing/speaking without a live operation → recover to idle (no auto-listen). */
const STUCK_STATE_WATCHDOG_MS = 8_000
/** Realtime speak with no audible start → classic fallback for this turn. */
const SILENT_REALTIME_FALLBACK_MS = 4_500

/** User-facing voice errors — never expose technical / provider details. */
const USER_SAFE_ERRORS = {
  mic: 'Microphone needs permission',
  connect: 'Could not start voice. You can type instead.',
  reconnect: 'Connection lost. You can retry or type instead.',
  device: 'Microphone disconnected. Tap to try again, or type instead.',
  unsupported: 'Voice is unavailable in this browser. You can type instead.',
  playback: 'تعذر تشغيل الصوت. سأكمل معك بالنص الآن.',
  fallback: 'سأكمل معك بصوت مبسّط.',
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
  /** Env/factory requested mode (realtime|classic|auto). */
  requestedTransport: BilamoVoiceTransportMode | null
  partialTranscript: string
  finalTranscript: string | null
  normalizedForExtract: string | null
  generation: number
  error: string | null
  lastSafeErrorCode: string | null
  fellBackToClassic: boolean
  locale: VoiceLocale
  conversationId: string | null
  listening: boolean
  speaking: boolean
  /** True when user can start a new voice turn immediately (idle + not speaking). */
  secondTurnReady: boolean
  audioContextState: string | null
  playback: VoicePlaybackDiagnostics
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
  /**
   * End-of-speech finalize: commit/emit final transcript once, then processing.
   * Does NOT auto-relisten after assistant playback.
   */
  finalizeListening: () => void
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
  /** Force idle after terminal errors — never auto-listen. */
  releaseToIdle: (reason?: string) => void
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
  let requestedTransport: BilamoVoiceTransportMode | null = options.mode ?? null
  let partialTranscript = ''
  let finalTranscript: string | null = null
  let normalizedForExtract: string | null = null
  let generation = 0
  let error: string | null = null
  let lastSafeErrorCode: string | null = null
  let fellBackToClassic = false
  let locale: VoiceLocale = options.locale ?? 'en'
  let conversationId: string | null = options.conversationId ?? null
  let disposed = false
  let prepared = false
  let lastFinalKey = ''
  /** Transport speak generation currently allowed to drive speaking state. */
  let activeSpeakTransportGen = -1
  /** True while transport.speak() may fire synchronous onSpeakingStart. */
  let armingSpeak = false
  let onFinalUtterance: ((event: BilamoTranscriptEvent) => void) | null =
    options.onFinalUtterance ?? null
  let guardsAttached = false
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  let silentRealtimeTimer: ReturnType<typeof setTimeout> | null = null
  let classicFallbackInFlight = false
  let playbackDiag = emptyVoicePlaybackDiagnostics()
  /** Stable snapshot reference for useSyncExternalStore (must not allocate every read). */
  let snapshot: BilamoVoiceSessionSnapshot = {
    state: 'idle',
    connection: 'idle',
    transportKind: null,
    requestedTransport,
    partialTranscript: '',
    finalTranscript: null,
    normalizedForExtract: null,
    generation: 0,
    error: null,
    lastSafeErrorCode: null,
    fellBackToClassic: false,
    locale,
    conversationId,
    listening: false,
    speaking: false,
    secondTurnReady: true,
    audioContextState: null,
    playback: emptyVoicePlaybackDiagnostics(),
  }

  const clearWatchdog = () => {
    if (watchdogTimer != null) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
  }

  const clearSilentRealtimeTimer = () => {
    if (silentRealtimeTimer != null) {
      clearTimeout(silentRealtimeTimer)
      silentRealtimeTimer = null
    }
  }

  const refreshSnapshot = () => {
    const transportSpeaking = transport?.isSpeaking() ?? false
    const transportListening = transport?.isListening() ?? false
    const fromTransport = transport?.getPlaybackDiagnostics?.()
    if (fromTransport) {
      // Transport owns peer/ICE/remote-track/play() fields. Session owns turn FSM flags.
      // Never let transport defaults wipe sticky session diagnostics mid-turn.
      const sessionSticky = {
        speechDetected: playbackDiag.speechDetected,
        endOfSpeechDetected: playbackDiag.endOfSpeechDetected,
        inputCommitted: playbackDiag.inputCommitted,
        finalTranscriptReceived: playbackDiag.finalTranscriptReceived,
        assistantResponseCreated: playbackDiag.assistantResponseCreated,
        classicFallbackInvoked: playbackDiag.classicFallbackInvoked,
        interruptAcknowledged: playbackDiag.interruptAcknowledged,
        stuckWatchdogCount: playbackDiag.stuckWatchdogCount,
        lastFsmTransition: playbackDiag.lastFsmTransition,
      }
      playbackDiag = {
        ...playbackDiag,
        ...fromTransport,
        speechDetected: sessionSticky.speechDetected || Boolean(fromTransport.speechDetected),
        endOfSpeechDetected:
          sessionSticky.endOfSpeechDetected || Boolean(fromTransport.endOfSpeechDetected),
        inputCommitted: sessionSticky.inputCommitted || Boolean(fromTransport.inputCommitted),
        finalTranscriptReceived:
          sessionSticky.finalTranscriptReceived || Boolean(fromTransport.finalTranscriptReceived),
        assistantResponseCreated:
          sessionSticky.assistantResponseCreated
          || Boolean(fromTransport.assistantResponseCreated),
        classicFallbackInvoked:
          sessionSticky.classicFallbackInvoked || Boolean(fromTransport.classicFallbackInvoked),
        interruptAcknowledged:
          sessionSticky.interruptAcknowledged || Boolean(fromTransport.interruptAcknowledged),
        stuckWatchdogCount: Math.max(
          sessionSticky.stuckWatchdogCount,
          fromTransport.stuckWatchdogCount ?? 0,
        ),
        lastFsmTransition: sessionSticky.lastFsmTransition || fromTransport.lastFsmTransition,
      }
    }
    playbackDiag.audioContextState = readAudioContextState()
    const secondTurnReady =
      !disposed
      && (state === 'idle' || state === 'error')
      && !transportSpeaking
      && activeSpeakTransportGen < 0
    snapshot = {
      state,
      connection,
      transportKind,
      requestedTransport,
      partialTranscript,
      finalTranscript,
      normalizedForExtract,
      generation,
      error,
      lastSafeErrorCode,
      fellBackToClassic,
      locale,
      conversationId,
      listening: transportListening,
      speaking: transportSpeaking || state === 'speaking',
      secondTurnReady,
      audioContextState: playbackDiag.audioContextState,
      playback: { ...playbackDiag },
    }
  }

  const emit = () => {
    refreshSnapshot()
    for (const listener of listeners) listener(snapshot)
  }

  const releaseToIdle = (reason = 'release_to_idle') => {
    if (disposed) return
    clearWatchdog()
    clearSilentRealtimeTimer()
    activeSpeakTransportGen = -1
    armingSpeak = false
    if (reason === 'watchdog') {
      playbackDiag.lastEvent = 'watchdogIdleRecovery'
      lastSafeErrorCode = 'watchdog_idle_recovery'
    }
    if (state !== 'idle') {
      state = 'idle'
    }
    emit()
  }

  const armStuckWatchdog = () => {
    clearWatchdog()
    if (disposed) return
    if (state !== 'processing' && state !== 'speaking' && state !== 'connecting') return
    const genAtArm = generation
    const stateAtArm = state
    watchdogTimer = setTimeout(() => {
      if (disposed) return
      const liveOp =
        transport?.isSpeaking()
        || transport?.isListening()
        || armingSpeak
        || (activeSpeakTransportGen >= 0 && transport?.isSpeaking())
      if (liveOp) {
        armStuckWatchdog()
        return
      }
      if (generation !== genAtArm) return
      if (state !== stateAtArm && state !== 'processing' && state !== 'speaking') return
      // No legitimate active operation — recover to idle without auto-listen.
      playbackDiag.stuckWatchdogCount += 1
      releaseToIdle('watchdog')
    }, STUCK_STATE_WATCHDOG_MS)
  }

  const setState = (next: BilamoVoiceSessionState) => {
    if (disposed) return
    if (state === next) {
      if (next === 'processing' || next === 'speaking' || next === 'connecting') {
        armStuckWatchdog()
      }
      return
    }
    state = next
    if (next === 'idle' || next === 'error' || next === 'listening') {
      clearWatchdog()
      if (next === 'listening') clearSilentRealtimeTimer()
    } else if (next === 'processing' || next === 'speaking' || next === 'connecting') {
      armStuckWatchdog()
    }
    if (next === 'speaking') clearSilentRealtimeTimer()
    emit()
  }

  const getSnapshot = (): BilamoVoiceSessionSnapshot => snapshot

  /** Internal: silent realtime → classic TTS for the same spoken text. */
  let pendingClassicFallbackText: { gen: number; text: string; locale: VoiceLocale } | null = null

  const runClassicFallback = async (failedGen: number) => {
    if (disposed || classicFallbackInFlight) return
    const pending = pendingClassicFallbackText
    if (!pending || pending.gen !== failedGen) return
    classicFallbackInFlight = true
    clearSilentRealtimeTimer()
    try {
      transport?.interrupt()
      activeSpeakTransportGen = -1
      if (transportKind !== 'classic_tts') {
        error = USER_SAFE_ERRORS.fallback
        transport?.dispose()
        const result = await createTransport({ mode: 'classic', forceClassic: true })
        fellBackToClassic = true
        transportKind = result.transport.kind
        wireTransport(result.transport)
        prepared = true
        playbackDiag.lastEvent = 'classicFallback'
        playbackDiag.classicFallbackInvoked = true
        emit()
      }
      const spoken = pending.text.trim()
      pendingClassicFallbackText = null
      if (!spoken) {
        releaseToIdle('silent_realtime_no_text')
        return
      }
      // Re-enter speak on classic — session.speak bumps generation.
      const handle = session.speak(spoken, pending.locale)
      await handle.done
    } finally {
      classicFallbackInFlight = false
    }
  }

  const wireTransport = (t: BilamoVoiceTransport) => {
    transport = t
    transportKind = t.kind
    metrics.setTransportKind(t.kind)
    t.setCallbacks({
      onPartialTranscript: (event) => {
        if (disposed) return
        partialTranscript = event.text
        if (event.text.trim()) {
          playbackDiag.speechDetected = true
          playbackDiag.lastEvent = 'speechDetected'
        }
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
        playbackDiag.finalTranscriptReceived = true
        playbackDiag.inputCommitted = true
        playbackDiag.lastEvent = 'finalTranscriptReceived'
        metrics.mark('final_transcript')
        setState('processing')
        onFinalUtterance?.(event)
      },
      onSpeakingStart: (gen) => {
        if (disposed) return
        // Accept sync start that fires inside transport.speak() before we arm the gen.
        if (armingSpeak) {
          activeSpeakTransportGen = gen
        } else if (gen !== activeSpeakTransportGen) {
          return
        }
        clearSilentRealtimeTimer()
        metrics.mark('speak_start')
        playbackDiag.audioPlaybackStarted = true
        playbackDiag.lastEvent = 'audioPlaybackStarted'
        // first_audio is marked on real audio chunk / playback — not assumed here.
        setState('speaking')
      },
      onSpeakingEnd: (gen) => {
        if (disposed || gen !== activeSpeakTransportGen) return
        activeSpeakTransportGen = -1
        clearSilentRealtimeTimer()
        metrics.mark('speak_end')
        playbackDiag.audioPlaybackEnded = true
        playbackDiag.lastEvent = 'audioPlaybackEnded'
        // No auto-relisten after natural speak end — idle until user taps.
        if (state === 'speaking' || state === 'interrupted' || state === 'processing') {
          setState('idle')
        }
      },
      onAudioChunk: (info) => {
        if (info.generation === activeSpeakTransportGen || armingSpeak) {
          metrics.mark('first_audio')
          playbackDiag.audioPlaybackStarted = true
          playbackDiag.lastEvent = 'audioPlaybackStarted'
        }
      },
      onSilentPlayback: (detail) => {
        if (disposed || detail.generation !== activeSpeakTransportGen) return
        lastSafeErrorCode = detail.code
        playbackDiag.audioPlaybackFailed = true
        playbackDiag.lastEvent = 'silentRealtimeTimeout'
        playbackDiag.lastSafeErrorCode = detail.code
        void runClassicFallback(detail.generation)
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
        lastSafeErrorCode = code || 'voice_error'
        playbackDiag.lastSafeErrorCode = lastSafeErrorCode
        if (code === 'not-allowed' || /permission/i.test(message)) {
          error = USER_SAFE_ERRORS.mic
        } else if (code === 'unsupported_browser') {
          error = USER_SAFE_ERRORS.unsupported
        } else if (code === 'device_lost' || code === 'audio_device_lost') {
          error = USER_SAFE_ERRORS.device
        } else if (code === 'playback_blocked' || code === 'playback_unsupported' || /تشغيل الصوت/i.test(message)) {
          error = USER_SAFE_ERRORS.playback
          playbackDiag.audioPlaybackFailed = true
          playbackDiag.lastEvent = 'audioPlaybackFailed'
          // Playback blocked — keep text usable; never stay stuck in speaking/processing.
          activeSpeakTransportGen = -1
          clearSilentRealtimeTimer()
          setState('idle')
          return
        } else if (code.startsWith('reconnect') || code === 'connect_failed') {
          error = USER_SAFE_ERRORS.reconnect
        } else {
          // Never surface raw provider / WebRTC strings to travelers.
          error = USER_SAFE_ERRORS.connect
        }
        setState('error')
        // Recoverable errors should not permanently disable the next mic tap.
        if (detail?.recoverable) {
          globalThis.setTimeout(() => {
            if (!disposed && state === 'error') releaseToIdle('recoverable_error')
          }, 50)
        }
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
      requestedTransport = result.mode
      fellBackToClassic = result.fellBack
      wireTransport(result.transport)
      prepared = true
      // Quiet prepare fallback — surface a neutral note only after an explicit
      // realtime connect failure (see connect → switchToClassic).
      // Staging: publish early so transportKind is readable before first utterance.
      publishBilamoVoiceMetrics(metrics.report())
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
        publishBilamoVoiceMetrics(metrics.report())
      } catch {
        metrics.mark('connect_fail')
        // Auto-fallback to classic if realtime connect fails.
        if (transport?.kind === 'realtime_webrtc') {
          await session.switchToClassic()
          try {
            await transport!.connect()
            metrics.mark('connect_ok')
            error = USER_SAFE_ERRORS.fallback
            setState('idle')
            publishBilamoVoiceMetrics(metrics.report())
            return
          } catch {
            /* fall through */
          }
        }
        error = USER_SAFE_ERRORS.connect
        setState('error')
        publishBilamoVoiceMetrics(metrics.report())
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
      // Fresh turn diagnostics — sticky EOS/commit flags must not block the next finalize.
      playbackDiag.speechDetected = false
      playbackDiag.endOfSpeechDetected = false
      playbackDiag.inputCommitted = false
      playbackDiag.finalTranscriptReceived = false
      playbackDiag.assistantResponseCreated = false
      playbackDiag.classicFallbackInvoked = false
      playbackDiag.interruptAcknowledged = false
      playbackDiag.audioPlayRequested = false
      playbackDiag.audioPlaybackStarted = false
      playbackDiag.audioPlaybackFailed = false
      playbackDiag.audioPlaybackEnded = false
      playbackDiag.playResult = null
      playbackDiag.lastEvent = null
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
      // Soft stop (background / cancel). Silence + orb end-of-speech must call finalizeListening.
      transport?.stopListening()
      if (state === 'listening' || state === 'interrupted') setState('idle')
    },
    finalizeListening() {
      if (disposed) return
      if (state !== 'listening' && state !== 'interrupted') {
        // Still allow transport finalize if mic is live (desync recovery).
        if (!transport?.isListening()) return
      }
      // Exactly-once at session layer (silence timer + orb tap + transport VAD).
      if (playbackDiag.endOfSpeechDetected && state === 'processing') {
        return
      }
      playbackDiag.endOfSpeechDetected = true
      playbackDiag.lastEvent = 'endOfSpeechDetected'
      playbackDiag.lastFsmTransition = `${state}->finalizing`
      // Transitional: waiting for final transcript emit (exactly once via lastFinalKey).
      if (state === 'listening' || state === 'interrupted') {
        setState('processing')
      }
      if (typeof transport?.finalizeListening === 'function') {
        transport.finalizeListening()
      } else {
        transport?.stopListening()
      }
      emit()
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
      const trimmed = text.trim()
      if (!trimmed) {
        // Empty speak must never leave the session in processing.
        if (state === 'processing' || state === 'speaking') releaseToIdle('empty_speak')
        return { generation: sessionGen, done: Promise.resolve() }
      }

      metrics.mark('response_start')
      playbackDiag.audioPlayRequested = true
      playbackDiag.audioPlaybackStarted = false
      playbackDiag.audioPlaybackFailed = false
      playbackDiag.audioPlaybackEnded = false
      playbackDiag.lastEvent = 'audioPlayRequested'
      // Stay in processing until onSpeakingStart proves audible playback began.
      if (state !== 'listening' && state !== 'interrupted') setState('processing')

      const finishSpeak = async (handle: BilamoSpeakHandle) => {
        await handle.done
        clearSilentRealtimeTimer()
        if (generation !== sessionGen) return
        // Always clear speaking generation for this handle when done.
        if (activeSpeakTransportGen === handle.generation) {
          activeSpeakTransportGen = -1
        }
        if (state === 'speaking' || state === 'interrupted' || state === 'processing') {
          setState('idle')
        }
        publishBilamoVoiceMetrics(metrics.report())
      }

      const armAndSpeak = (): BilamoSpeakHandle | null => {
        if (disposed || generation !== sessionGen || !transport) return null
        armingSpeak = true
        let handle: BilamoSpeakHandle
        try {
          handle = transport.speak({
            text: trimmed,
            locale: speakLocale ?? locale,
          })
        } finally {
          armingSpeak = false
        }
        if (generation !== sessionGen) {
          transport.interrupt()
          return null
        }
        activeSpeakTransportGen = handle.generation
        // Never claim speaking from isSpeaking() alone — wait for onSpeakingStart (audible).
        if (transport.kind === 'realtime_webrtc' && !fellBackToClassic) {
          pendingClassicFallbackText = {
            gen: handle.generation,
            text: trimmed,
            locale: speakLocale ?? locale,
          }
          clearSilentRealtimeTimer()
          silentRealtimeTimer = globalThis.setTimeout(() => {
            if (disposed || generation !== sessionGen) return
            if (state === 'speaking' || playbackDiag.audioPlaybackStarted) return
            lastSafeErrorCode = 'silent_realtime_timeout'
            playbackDiag.lastEvent = 'silentRealtimeTimeout'
            playbackDiag.audioPlaybackFailed = true
            void runClassicFallback(handle.generation)
          }, SILENT_REALTIME_FALLBACK_MS)
        }
        return handle
      }

      // Sync path when already prepared — lets onSpeakingStart arm immediately.
      if (prepared && transport) {
        const handle = armAndSpeak()
        if (!handle) {
          releaseToIdle('speak_aborted')
          return { generation: sessionGen, done: Promise.resolve() }
        }
        return { generation: sessionGen, done: finishSpeak(handle) }
      }

      const done = (async () => {
        if (!prepared) await session.prepare()
        if (disposed || generation !== sessionGen || !transport) {
          releaseToIdle('speak_prepare_aborted')
          return
        }
        const handle = armAndSpeak()
        if (!handle) {
          releaseToIdle('speak_aborted')
          return
        }
        await finishSpeak(handle)
      })()

      return { generation: sessionGen, done }
    },
    interrupt() {
      metrics.mark('interrupt')
      generation += 1
      activeSpeakTransportGen = -1
      clearSilentRealtimeTimer()
      transport?.interrupt()
      metrics.mark('interrupt_ack')
      playbackDiag.interruptAcknowledged = true
      playbackDiag.lastEvent = 'interruptAcknowledged'
      // Always clear transitional states — processing latch was the Safari second-turn deadlock.
      if (
        state === 'speaking'
        || state === 'interrupted'
        || state === 'processing'
        || state === 'connecting'
      ) {
        setState('idle')
      }
      publishBilamoVoiceMetrics(metrics.report())
    },
    async switchToClassic() {
      transport?.dispose()
      const result = await createTransport({ mode: 'classic', forceClassic: true })
      fellBackToClassic = true
      transportKind = result.transport.kind
      wireTransport(result.transport)
      prepared = true
      playbackDiag.lastEvent = 'classicFallback'
      emit()
    },
    clearError() {
      error = null
      lastSafeErrorCode = null
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
    releaseToIdle,
    getMetrics: () => metrics.snapshot(),
    getMetricsReport: () => metrics.report(),
    attachReliabilityGuards() {
      if (guardsAttached || typeof document === 'undefined') return () => {}
      guardsAttached = true

      const onVisibility = () => {
        if (!document.hidden) {
          // Foreground: resume AudioContext if suspended — never auto-relisten.
          void import('../../chat/voice/audioElementTextToSpeechProvider')
            .then((m) => m.unlockAudioPlayback())
            .catch(() => undefined)
            .finally(() => emit())
          return
        }
        // Background: soft-stop capture / playback; never auto-submit or auto-relisten.
        if (state === 'listening') {
          transport?.stopListening()
          setState('idle')
        } else if (state === 'speaking' || state === 'processing') {
          session.interrupt()
        }
      }

      const onPageHide = () => {
        if (state === 'listening' || state === 'speaking' || state === 'processing') {
          session.interrupt()
          transport?.stopListening()
          releaseToIdle('pagehide')
        }
      }

      const onDeviceChange = () => {
        // Device loss while listening — surface recovery, do not auto-reopen mic.
        if (state === 'listening' || transport?.isListening()) {
          transport?.stopListening()
          error = USER_SAFE_ERRORS.device
          lastSafeErrorCode = 'audio_device_lost'
          setState('error')
        }
      }

      document.addEventListener('visibilitychange', onVisibility)
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', onPageHide)
        window.addEventListener('pageshow', () => emit())
      }
      const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null
      md?.addEventListener?.('devicechange', onDeviceChange)

      return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        if (typeof window !== 'undefined') {
          window.removeEventListener('pagehide', onPageHide)
        }
        md?.removeEventListener?.('devicechange', onDeviceChange)
        guardsAttached = false
      }
    },
    dispose() {
      disposed = true
      clearWatchdog()
      clearSilentRealtimeTimer()
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
