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
  speechRecognitionSupported,
  type VoicePlaybackDiagnostics,
} from './voicePlaybackDiagnostics'
import {
  applyVoiceHttpTrace,
  beginVoiceTurnCorrelation,
  noteVoiceTurnStage,
} from './voiceHttpTrace'
import { probeVoiceAuth } from '../../security/voiceAuthProbe'
import { logChat } from '../../chat/chatLogger'

/** Stuck processing/speaking without a live operation → recover to idle (no auto-listen). */
const STUCK_STATE_WATCHDOG_MS = 8_000
/** Finalize with no final transcript → release idle (must not wait on 8s watchdog). */
const EMPTY_FINALIZE_MS = 1_400
/** Realtime speak with no audible start → classic fallback for this turn. */
const SILENT_REALTIME_FALLBACK_MS = 2_500

/** User-facing voice errors — never expose technical / provider details. */
const USER_SAFE_ERRORS = {
  mic: 'Microphone needs permission',
  connect: 'Could not start voice. You can type instead.',
  reconnect: 'Connection lost. You can retry or type instead.',
  device: 'Microphone disconnected. Tap to try again, or type instead.',
  unsupported: 'Voice is unavailable in this browser. You can type instead.',
  /** Only after reconnect + classic TTS both fail — never “continue in text”. */
  playback: 'تعذر تشغيل الصوت. يمكنك المحاولة مرة أخرى.',
  fallback: 'أعيد تشغيل الصوت بصوت أوضح…',
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
  /** Soft-cancel mic without emitting a final transcript. */
  cancelListening: () => void
  /**
   * End-of-speech finalize: commit/emit final transcript once, then processing.
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
  /** ChatGPT-Voice parity: after first orb tap, re-arm mic when playback ends. */
  setContinuousListening: (enabled: boolean) => void
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
  let emptyFinalizeTimer: ReturnType<typeof setTimeout> | null = null
  let classicFallbackInFlight = false
  /** One realtime reconnect attempt per speak generation before classic TTS. */
  let playbackReconnectAttempted = false
  /** After first user orb tap — re-arm mic when assistant playback ends. */
  let continuousListening = false
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
        correlationId: playbackDiag.correlationId,
        turnStage: playbackDiag.turnStage,
        timestampMs: playbackDiag.timestampMs,
        authenticatedUser: playbackDiag.authenticatedUser,
        supabaseSessionAvailable: playbackDiag.supabaseSessionAvailable,
        requestDispatched: playbackDiag.requestDispatched,
        httpRoute: playbackDiag.httpRoute,
        httpStatus: playbackDiag.httpStatus,
        safeServerErrorCode: playbackDiag.safeServerErrorCode,
        realtimeSessionCreated: playbackDiag.realtimeSessionCreated,
        classicFallbackHttpStatus: playbackDiag.classicFallbackHttpStatus,
        discardReason: playbackDiag.discardReason,
        authProbeCode: playbackDiag.authProbeCode,
        mediaStreamActive: playbackDiag.mediaStreamActive,
        speechRecognitionSupported: playbackDiag.speechRecognitionSupported,
        language: playbackDiag.language,
        dialect: playbackDiag.dialect,
        transcriptConfidence: playbackDiag.transcriptConfidence,
        normalizedIntent: playbackDiag.normalizedIntent,
        firstPartialLatencyMs: playbackDiag.firstPartialLatencyMs,
        finalTranscriptLatencyMs: playbackDiag.finalTranscriptLatencyMs,
        submitLatencyMs: playbackDiag.submitLatencyMs,
        audible: playbackDiag.audible || playbackDiag.audioPlaybackStarted,
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
        correlationId: sessionSticky.correlationId || fromTransport.correlationId,
        turnStage: sessionSticky.turnStage,
        timestampMs: sessionSticky.timestampMs ?? fromTransport.timestampMs,
        authenticatedUser: sessionSticky.authenticatedUser ?? fromTransport.authenticatedUser,
        supabaseSessionAvailable:
          sessionSticky.supabaseSessionAvailable ?? fromTransport.supabaseSessionAvailable,
        requestDispatched: sessionSticky.requestDispatched || Boolean(fromTransport.requestDispatched),
        httpRoute: sessionSticky.httpRoute || fromTransport.httpRoute,
        httpStatus: sessionSticky.httpStatus ?? fromTransport.httpStatus,
        safeServerErrorCode: sessionSticky.safeServerErrorCode || fromTransport.safeServerErrorCode,
        realtimeSessionCreated:
          sessionSticky.realtimeSessionCreated ?? fromTransport.realtimeSessionCreated,
        classicFallbackHttpStatus:
          sessionSticky.classicFallbackHttpStatus ?? fromTransport.classicFallbackHttpStatus,
        discardReason: sessionSticky.discardReason || fromTransport.discardReason,
        authProbeCode: sessionSticky.authProbeCode || fromTransport.authProbeCode,
        mediaStreamActive: sessionSticky.mediaStreamActive ?? fromTransport.mediaStreamActive,
        speechRecognitionSupported:
          sessionSticky.speechRecognitionSupported ?? fromTransport.speechRecognitionSupported,
        language: sessionSticky.language || fromTransport.language,
        dialect: sessionSticky.dialect || fromTransport.dialect,
        transcriptConfidence: sessionSticky.transcriptConfidence ?? fromTransport.transcriptConfidence,
        normalizedIntent: sessionSticky.normalizedIntent || fromTransport.normalizedIntent,
        firstPartialLatencyMs: sessionSticky.firstPartialLatencyMs ?? fromTransport.firstPartialLatencyMs,
        finalTranscriptLatencyMs:
          sessionSticky.finalTranscriptLatencyMs ?? fromTransport.finalTranscriptLatencyMs,
        submitLatencyMs: sessionSticky.submitLatencyMs ?? fromTransport.submitLatencyMs,
        audible:
          sessionSticky.audible
          || Boolean(fromTransport.audible)
          || playbackDiag.audioPlaybackStarted
          || Boolean(fromTransport.audioPlaybackStarted),
      }
    }
    playbackDiag.audioContextState = readAudioContextState()
    if (playbackDiag.speechRecognitionSupported == null) {
      playbackDiag.speechRecognitionSupported = speechRecognitionSupported()
    }
    playbackDiag = applyVoiceHttpTrace(playbackDiag)
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

  const clearEmptyFinalizeTimer = () => {
    if (emptyFinalizeTimer != null) {
      clearTimeout(emptyFinalizeTimer)
      emptyFinalizeTimer = null
    }
  }

  const releaseToIdle = (reason = 'release_to_idle') => {
    if (disposed) return
    clearWatchdog()
    clearSilentRealtimeTimer()
    clearEmptyFinalizeTimer()
    activeSpeakTransportGen = -1
    armingSpeak = false
    if (reason === 'watchdog') {
      playbackDiag.lastEvent = 'watchdogIdleRecovery'
      lastSafeErrorCode = 'watchdog_idle_recovery'
    } else if (reason === 'empty_finalize') {
      playbackDiag.lastEvent = 'emptyFinalizeIdle'
      lastSafeErrorCode = 'empty_finalize'
    }
    noteVoiceTurnStage('idle')
    playbackDiag.turnStage = 'idle'
    if (state !== 'idle') {
      state = 'idle'
    }
    emit()
  }

  const rearmContinuousListening = () => {
    if (disposed || !continuousListening) return
    if (state !== 'idle') return
    void session.startListening().then((ok) => {
      if (!ok && continuousListening) {
        // Stay idle — traveler can tap; do not latch error forever.
        releaseToIdle('continuous_rearm_failed')
      }
    })
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

  /** Internal: silent/blocked realtime → reconnect once → classic TTS (same text). */
  let pendingClassicFallbackText: { gen: number; text: string; locale: VoiceLocale } | null = null

  const runClassicFallback = async (failedGen: number) => {
    if (disposed || classicFallbackInFlight) return
    const pending = pendingClassicFallbackText
    if (!pending || pending.gen !== failedGen) return
    classicFallbackInFlight = true
    clearSilentRealtimeTimer()
    logChat('warn', 'voice', 'REALTIME_AUDIO_FAILED', {
      generation: failedGen,
      next: 'CLASSIC_TTS',
    })
    try {
      transport?.interrupt()
      activeSpeakTransportGen = -1
      // Do not surface “continue in text” — classic TTS must speak the same reply.
      error = null
      if (transportKind !== 'classic_tts') {
        transport?.dispose()
        const result = await createTransport({ mode: 'classic', forceClassic: true })
        fellBackToClassic = true
        transportKind = result.transport.kind
        wireTransport(result.transport)
        prepared = true
        playbackDiag.lastEvent = 'CLASSIC_FALLBACK_STARTED'
        playbackDiag.classicFallbackInvoked = true
        emit()
      }
      const spoken = pending.text.trim()
      pendingClassicFallbackText = null
      if (!spoken) {
        releaseToIdle('silent_realtime_no_text')
        return
      }
      const handle = session.speak(spoken, pending.locale)
      await handle.done
      if (!playbackDiag.audioPlaybackStarted) {
        // Classic also silent — last-resort user guidance (still not text-only reply).
        logChat('error', 'voice', 'VOICE_OUTPUT_FAILED', {
          generation: failedGen,
          stage: 'classic_silent',
        })
        error = USER_SAFE_ERRORS.playback
        lastSafeErrorCode = 'playback_exhausted'
        setState('idle')
      } else {
        logChat('debug', 'voice', 'REALTIME_AUDIO_FAILED → CLASSIC_TTS_OK', {
          generation: failedGen,
        })
        error = null
      }
    } finally {
      classicFallbackInFlight = false
    }
  }

  /**
   * Mandatory audible recovery:
   * realtime play fail → reconnect once → classic TTS.
   * Never leave the traveler with text-only after a spoken reply was prepared.
   */
  const recoverAudiblePlayback = async (failedGen: number) => {
    if (disposed || classicFallbackInFlight) return
    const pending = pendingClassicFallbackText
    if (!pending || pending.gen !== failedGen) return

    clearSilentRealtimeTimer()
    playbackDiag.audioPlaybackFailed = true

    // Already on classic (or already recovered once) — one retry then stop (no text-only path).
    if (transportKind === 'classic_tts' || fellBackToClassic) {
      if (playbackReconnectAttempted) {
        error = USER_SAFE_ERRORS.playback
        lastSafeErrorCode = 'playback_exhausted'
        activeSpeakTransportGen = -1
        setState('idle')
        return
      }
      playbackReconnectAttempted = true
      const spoken = pending.text.trim()
      const loc = pending.locale
      pendingClassicFallbackText = null
      const handle = session.speak(spoken, loc)
      await handle.done
      if (!playbackDiag.audioPlaybackStarted) {
        error = USER_SAFE_ERRORS.playback
        lastSafeErrorCode = 'playback_exhausted'
        setState('idle')
      } else {
        error = null
      }
      return
    }

    if (transportKind === 'realtime_webrtc' && !playbackReconnectAttempted) {
      playbackReconnectAttempted = true
      playbackDiag.lastEvent = 'audioPlaybackFailed'
      lastSafeErrorCode = 'playback_reconnect'
      emit()
      try {
        transport?.interrupt()
        activeSpeakTransportGen = -1
        await transport?.connect()
        const spoken = pending.text.trim()
        const loc = pending.locale
        pendingClassicFallbackText = null
        const handle = session.speak(spoken, loc)
        await Promise.race([
          handle.done,
          new Promise<void>((resolve) => {
            globalThis.setTimeout(resolve, 5_000)
          }),
        ])
        if (playbackDiag.audioPlaybackStarted || state === 'speaking') {
          error = null
          return
        }
        // speak() re-arms pending synchronously; CF analysis cannot see the mutation.
        const armed = pendingClassicFallbackText as {
          gen: number
          text: string
          locale: VoiceLocale
        } | null
        if (armed) {
          await runClassicFallback(armed.gen)
        } else {
          pendingClassicFallbackText = { gen: handle.generation, text: spoken, locale: loc }
          await runClassicFallback(handle.generation)
        }
        return
      } catch {
        // Fall through to classic.
      }
    }

    await runClassicFallback(failedGen)
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
        // Generation owns this transcript — ignore duplicates / late interim echoes.
        const key = event.text.trim()
        if (!key || key === lastFinalKey) return
        if (state === 'processing' || state === 'speaking') {
          // Already handed off this turn — never double-submit.
          if (lastFinalKey) return
        }
        clearEmptyFinalizeTimer()
        lastFinalKey = key
        finalTranscript = event.text
        normalizedForExtract = event.normalizedForExtract ?? null
        partialTranscript = ''
        playbackDiag.finalTranscriptReceived = true
        playbackDiag.inputCommitted = true
        playbackDiag.lastEvent = 'finalTranscriptReceived'
        noteVoiceTurnStage('requesting')
        playbackDiag.turnStage = 'requesting'
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
        playbackDiag.audible = true
        playbackDiag.lastEvent = 'audioPlaybackStarted'
        playbackDiag.playResult = 'resolved'
        noteVoiceTurnStage('playing')
        playbackDiag.turnStage = 'playing'
        playbackReconnectAttempted = false
        error = null
        logChat('debug', 'voice', fellBackToClassic ? 'CLASSIC_TTS_OK' : 'REALTIME_AUDIO_OK', {
          transport: transportKind,
          generation: gen,
        })
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
        noteVoiceTurnStage('idle')
        playbackDiag.turnStage = 'idle'
        if (state === 'speaking' || state === 'interrupted' || state === 'processing') {
          setState('idle')
        }
        // ChatGPT-Voice parity: next turn without a second orb tap.
        if (continuousListening) {
          globalThis.setTimeout(() => rearmContinuousListening(), 120)
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
        void recoverAudiblePlayback(detail.generation)
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
          // Mandatory audio: reconnect once → classic TTS. Never “continue in text”.
          playbackDiag.audioPlaybackFailed = true
          playbackDiag.lastEvent = 'audioPlaybackFailed'
          const gen =
            activeSpeakTransportGen >= 0
              ? activeSpeakTransportGen
              : pendingClassicFallbackText?.gen ?? -1
          clearSilentRealtimeTimer()
          if (gen >= 0 && pendingClassicFallbackText) {
            error = null
            void recoverAudiblePlayback(gen)
            return
          }
          // No pending spoken text (unexpected) — idle without text-fallback copy.
          error = USER_SAFE_ERRORS.playback
          activeSpeakTransportGen = -1
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
      void probeVoiceAuth().catch(() => undefined)
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
      // Soft auth probe for diagnostics only — server routes still enforce JWT.
      // Do not hard-fail connect here (would mask mic permission errors / block classic).
      const authProbe = await probeVoiceAuth().catch(() => ({
        ok: false,
        authenticatedUser: false,
        supabaseSessionAvailable: false,
        authProbeCode: 'AUTH_PROBE_FAILED' as string | null,
      }))
      if (!authProbe.ok) {
        lastSafeErrorCode = authProbe.authProbeCode || 'AUTH_REQUIRED'
        playbackDiag.authProbeCode = lastSafeErrorCode
        emit()
      }
      setState('connecting')
      try {
        await transport!.connect()
        metrics.mark('connect_ok')
        error = null
        playbackDiag.realtimeSessionCreated = transportKind === 'realtime_webrtc' ? true : playbackDiag.realtimeSessionCreated
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
      const correlationId = beginVoiceTurnCorrelation()
      playbackDiag = {
        ...emptyVoicePlaybackDiagnostics(),
        correlationId,
        turnStage: 'listening',
        speechRecognitionSupported: speechRecognitionSupported(),
        peerConnectionState: playbackDiag.peerConnectionState,
        iceConnectionState: playbackDiag.iceConnectionState,
        audioElementAttached: playbackDiag.audioElementAttached,
        remoteTrackReceived: playbackDiag.remoteTrackReceived,
        remoteTrackMuted: playbackDiag.remoteTrackMuted,
        remoteTrackReadyState: playbackDiag.remoteTrackReadyState,
        stuckWatchdogCount: playbackDiag.stuckWatchdogCount,
        timestampMs: Date.now(),
      }
      void probeVoiceAuth().catch(() => undefined)
      playbackReconnectAttempted = false
      metrics.mark('listen_start')
      const ok = await transport!.startListening(locale)
      if (ok) {
        metrics.mark('mic_ready')
        playbackDiag.mediaStreamActive = true
        noteVoiceTurnStage('listening')
        setState('listening')
        publishBilamoVoiceMetrics(metrics.report())
      } else {
        error = USER_SAFE_ERRORS.mic
        playbackDiag.mediaStreamActive = false
        noteVoiceTurnStage('error')
        setState('error')
        globalThis.setTimeout(() => {
          if (!disposed && state === 'error') releaseToIdle('mic_error_recover')
        }, 80)
      }
      return ok
    },
    stopListening() {
      // Soft stop (background / cancel). Silence + orb end-of-speech must call finalizeListening.
      clearEmptyFinalizeTimer()
      transport?.stopListening()
      if (state === 'listening' || state === 'interrupted') setState('idle')
    },
    cancelListening() {
      clearEmptyFinalizeTimer()
      if (typeof transport?.cancelListening === 'function') {
        transport.cancelListening()
      } else {
        transport?.stopListening()
      }
      if (state === 'listening' || state === 'interrupted' || state === 'processing') {
        setState('idle')
      }
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
      noteVoiceTurnStage('finalizing')
      playbackDiag.turnStage = 'finalizing'
      const genAtFinalize = generation
      const keyBefore = lastFinalKey
      // Transitional: waiting for final transcript emit (exactly once via lastFinalKey).
      if (state === 'listening' || state === 'interrupted') {
        setState('processing')
      }
      if (typeof transport?.finalizeListening === 'function') {
        transport.finalizeListening()
      } else {
        transport?.stopListening()
      }
      clearEmptyFinalizeTimer()
      emptyFinalizeTimer = globalThis.setTimeout(() => {
        emptyFinalizeTimer = null
        if (disposed || generation !== genAtFinalize) return
        if (playbackDiag.finalTranscriptReceived) return
        if (lastFinalKey !== keyBefore) return
        if (state !== 'processing') return
        // Empty / rejected ASR must not leave the orb stuck thinking.
        releaseToIdle('empty_finalize')
      }, EMPTY_FINALIZE_MS)
      emit()
    },
    setContinuousListening(enabled) {
      continuousListening = enabled
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
      playbackDiag.assistantResponseCreated = true
      playbackDiag.lastEvent = 'MODEL_RESPONSE_STARTED'
      noteVoiceTurnStage('response_ready')
      playbackDiag.turnStage = 'playback_starting'
      noteVoiceTurnStage('playback_starting')
      // Do not reset playbackReconnectAttempted here — that caused reconnect loops
      // when the post-reconnect speak also failed. Reset on listen start / audible start.
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
        // Arm audible recovery for realtime AND classic (classic recovers via retry path).
        pendingClassicFallbackText = {
          gen: handle.generation,
          text: trimmed,
          locale: speakLocale ?? locale,
        }
        if (transport.kind === 'realtime_webrtc' && !fellBackToClassic) {
          clearSilentRealtimeTimer()
          silentRealtimeTimer = globalThis.setTimeout(() => {
            if (disposed || generation !== sessionGen) return
            if (state === 'speaking' || playbackDiag.audioPlaybackStarted) return
            lastSafeErrorCode = 'silent_realtime_timeout'
            playbackDiag.lastEvent = 'silentRealtimeTimeout'
            playbackDiag.audioPlaybackFailed = true
            void recoverAudiblePlayback(handle.generation)
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
