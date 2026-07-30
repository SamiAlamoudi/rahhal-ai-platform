/**
 * OpenAI Realtime WebRTC session (speech-to-speech).
 * Uses the unified interface: browser SDP → /api/openai/realtime-call → SDP answer.
 *
 * One remote audio stream (no classic TTS clips) → no duplicate/stitched playback.
 * Barge-in: response.cancel ONLY when an active response is generating/speaking.
 * Never replays cancelled speech. Never surface cancel noise to the UI.
 */

import { logChat } from '../chatLogger'
import { dialectChatGuidance, loadVoiceExperiencePrefs } from './voiceExperiencePrefs'
import { REALTIME_PUBLIC_MODEL } from './voiceArchitecture'
import { buildConsultantConversationalInstructions, inferTripMood } from './consultantConversationalStyle'
import {
  inferSpokenContext,
  toSpokenDialogue,
  spokenToneCue,
} from './spokenDialoguePostProcessor'
import { buildRealtimeTurnDetection, mapPrefsToRealtimeVoice } from './realtimeTurnConfig'
import {
  createRealtimeQualityTracker,
  type RealtimeQualitySnapshot,
} from './realtimeQualityMetrics'
import {
  resolveConversationLanguage,
  type ConversationLanguageCode,
} from './conversationLanguageLayer'
import {
  createUserTranscriptGate,
  transcriptionLanguageHint,
  isConfirmedUserUtterance,
  looksLikeAssistantEcho,
  type LockedSpeechLanguage,
} from './userTranscriptGate'
import {
  isHarmlessRealtimeCancelError,
  toUserFacingVoiceError,
  VOICE_RECOVERABLE_ERROR_AR,
} from './voiceUserFacingError'
import { logMicSessionState, mapToMicSessionState } from './micSessionState'
import {
  ARABIC_UTTERANCE_COMMIT_MS,
  createArabicUtteranceAssembler,
  type AssembledUtteranceCommit,
} from './arabicUtteranceAssembler'
import { logPipeline } from '../pipelineDiagnostics'

export type RealtimeSessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'

export type RealtimeUserTranscriptMeta = {
  /** Exact committed ASR — same as text when isFinal. */
  committedTranscript?: string
  /** Parser-only enrichment; never shown as the user message rewrite. */
  normalizedForExtract?: string
  audioDurationMs?: number
  completionReason?: string
  conversationLanguage?: string
}

export type RealtimeWebRtcCallbacks = {
  onStatus?: (status: RealtimeSessionStatus) => void
  onUserTranscript?: (text: string, isFinal: boolean, meta?: RealtimeUserTranscriptMeta) => void
  /**
   * Soft ASR retry cue (incomplete / wrong-script). Not a technical error —
   * UI should show calmly, never as red technical diagnostics.
   */
  onAsrRetry?: (message: string, detail?: Record<string, unknown>) => void
  onAssistantTranscript?: (text: string, isFinal: boolean) => void
  /** Fired when barge-in cancels a reply mid-stream (partial text kept). */
  onInterrupted?: (partialAssistantText: string) => void
  onError?: (message: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
  /** Optional realtime quality metrics snapshots (barge-in / turn / first audio). */
  onQualitySnapshot?: (snapshot: RealtimeQualitySnapshot) => void
}

export type RealtimeWebRtcSession = {
  connect: () => Promise<void>
  /** End the WebRTC call but allow a later connect() on the same session object. */
  disconnect: () => void
  /**
   * Hard user Stop — cancel timers/VAD/playback callbacks and tear down.
   * No auto-listen / reconnect until the user explicitly calls connect() again.
   */
  hardStop: () => void
  /** Permanent teardown (component unmount). Further connect() calls are no-ops. */
  dispose: () => void
  interrupt: () => void
  /**
   * Re-arm mic + turn detection after an assistant turn without recreating WebRTC.
   * Safe no-op when not connected or after hardStop.
   */
  ensureListening: () => void
  /** True after hardStop until the next explicit connect(). */
  isHardStopped: () => boolean
  /** Send a text user turn into the live session (no classic TTS). */
  sendText: (text: string) => void
  /**
   * Speak a written assistant draft via Realtime after spoken-dialogue post-processing.
   * Does not change the Realtime engine — only the words fed into it.
   */
  speakWrittenDraft: (written: string, opts?: { locale?: 'ar' | 'en' }) => void
  getStatus: () => RealtimeSessionStatus
  isConnected: () => boolean
  getQualitySnapshot: () => RealtimeQualitySnapshot
}

type ActiveResponseState = {
  id: string
  createdAt: number
  /** Server finished streaming audio bytes for this response. */
  audioStreamDone: boolean
  /** WebRTC output buffer drained — actual playback complete (preferred). */
  playbackStopped: boolean
  responseDone: boolean
  cancelled: boolean
  /** True once any audio/transcript audio path started for this response. */
  hadAudio: boolean
  /** Language locked for this assistant turn — never switch mid-reply. */
  language: LockedSpeechLanguage
}

function buildInstructions(
  moodText: string | undefined,
  previousLanguage: Exclude<ConversationLanguageCode, 'auto'> | null,
): { instructions: string; language: Exclude<ConversationLanguageCode, 'auto'> } {
  const prefs = loadVoiceExperiencePrefs()
  const mood = moodText ? inferTripMood(moodText) : undefined
  const resolved = resolveConversationLanguage({
    preference: prefs.language,
    utterance: moodText,
    previousLanguage,
    // Arabic-first product default when fallback unset
    fallbackPreference: prefs.languageFallback || 'ar',
  })
  return {
    language: resolved.language,
    instructions: buildConsultantConversationalInstructions({
      dialect: prefs.dialect,
      utterance: moodText,
      language: prefs.language,
      previousLanguage,
      languageFallback: prefs.languageFallback || 'ar',
      locale: resolved.language === 'ar' ? 'ar' : 'en',
      mood,
      dialogueContext: moodText ? inferSpokenContext(moodText) : undefined,
      speed: prefs.speed,
      energy: prefs.energy,
    }),
  }
}

function transcriptionConfig(language: LockedSpeechLanguage | null) {
  // Always pass an explicit language — never leave auto-detect unconstrained.
  // Arabic-first product: default `ar` until the traveler explicitly switches.
  const hint = transcriptionLanguageHint(language) || 'ar'
  return { model: 'gpt-4o-mini-transcribe' as const, language: hint }
}

export function createRealtimeWebRtcSession(
  callbacks: RealtimeWebRtcCallbacks = {},
): RealtimeWebRtcSession {
  let status: RealtimeSessionStatus = 'idle'
  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let localStream: MediaStream | null = null
  let remoteAudio: HTMLAudioElement | null = null
  let remoteTrack: MediaStreamTrack | null = null
  let assistantBuffer = ''
  let disposed = false
  /**
   * User pressed Stop — block ALL auto listen / VAD / playback-complete restarts
   * until the next explicit connect().
   */
  let hardStopped = false
  /** Active spoken language for this Realtime call (language layer only). */
  let activeLanguage: LockedSpeechLanguage | null = 'ar'
  /** Language frozen for the current assistant response. */
  let assistantTurnLanguage: LockedSpeechLanguage | null = null
  let activeResponse: ActiveResponseState | null = null
  /** Last finalized assistant spoken text — used to reject self-echo transcripts. */
  let lastAssistantSpoken = ''
  /** When the last assistant turn fully completed (for post-response silence guard). */
  let responseDoneAt = 0
  /**
   * Client-authorized response.create only.
   * If response.created arrives without this flag, cancel it (unsolicited auto-turn).
   */
  let clientRequestedResponse = false
  /** Fallback timer when output_audio_buffer.stopped is missing. */
  let playbackFallbackTimer: ReturnType<typeof setTimeout> | null = null
  /** Generation token — invalidate pending playback/microtask callbacks after Stop. */
  let sessionGeneration = 0
  /** Locked committed user transcript for the current turn (immutable after commit). */
  let lockedUserTranscript: string | null = null
  const quality = createRealtimeQualityTracker()

  const transcriptGate = createUserTranscriptGate(() => activeLanguage)

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

  const emitQuality = () => {
    callbacks.onQualitySnapshot?.(quality.snapshot())
  }

  const sendEvent = (event: Record<string, unknown>) => {
    if (!dc || dc.readyState !== 'open') return
    dc.send(JSON.stringify(event))
  }

  const telemetry = (event: string, detail?: Record<string, unknown>) => {
    logChat('debug', 'voice', event, {
      activeResponseId: activeResponse?.id ?? null,
      status,
      language: activeLanguage,
      assistantTurnLanguage,
      hardStopped,
      ...detail,
    })
  }

  const setStatus = (next: RealtimeSessionStatus) => {
    if (hardStopped && next !== 'idle' && next !== 'error') {
      telemetry('status_blocked_hard_stopped', { attempted: next })
      return
    }
    status = next
    logMicSessionState(mapToMicSessionState(next, { hardStopped }), {
      source: 'realtime',
      rawStatus: next,
    })
    callbacks.onStatus?.(next)
  }

  const clearPlaybackTimers = () => {
    if (playbackFallbackTimer) {
      clearTimeout(playbackFallbackTimer)
      playbackFallbackTimer = null
    }
  }

  const muteLocalMic = () => {
    try {
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = false
      })
      pc?.getSenders().forEach((sender) => {
        const track = sender.track
        if (track && track.kind === 'audio') track.enabled = false
      })
    } catch {
      // ignore
    }
  }

  const disableTurnDetection = () => {
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            turn_detection: null,
          },
        },
      },
    })
  }

  const muteRemote = (muted: boolean) => {
    try {
      if (remoteTrack) remoteTrack.enabled = !muted
      if (remoteAudio) {
        if (muted) {
          remoteAudio.pause()
          remoteAudio.currentTime = 0
        } else {
          void remoteAudio.play().catch(() => undefined)
        }
      }
    } catch {
      // ignore
    }
  }

  const ensureLocalMicLive = () => {
    if (hardStopped || disposed) return
    try {
      localStream?.getAudioTracks().forEach((track) => {
        if (track.readyState === 'live') track.enabled = true
      })
      pc?.getSenders().forEach((sender) => {
        const track = sender.track
        if (track && track.kind === 'audio' && track.readyState === 'live') {
          track.enabled = true
        }
      })
    } catch {
      // ignore
    }
  }

  const clearActiveResponse = () => {
    activeResponse = null
    assistantTurnLanguage = null
  }

  const hasCancellableResponse = (): boolean => {
    if (!activeResponse) return false
    if (activeResponse.cancelled) return false
    // Still cancellable until playback has actually stopped (or text-only done).
    if (activeResponse.playbackStopped) return false
    if (!activeResponse.hadAudio && activeResponse.responseDone) return false
    return true
  }

  /**
   * Exactly one assistant response per confirmed user input.
   * Never call this on speech_stopped / silence / noise.
   */
  const requestAssistantResponse = (reason: string) => {
    if (disposed || hardStopped) return
    if (hasCancellableResponse()) {
      telemetry('response_create_skipped_active', { reason })
      return
    }
    clientRequestedResponse = true
    setStatus('thinking')
    telemetry('response_create_requested', { reason })
    sendEvent({ type: 'response.create' })
  }

  const shouldAcceptTranscriptForResponse = (text: string): boolean => {
    if (!isConfirmedUserUtterance(text)) return false
    const sinceDone = responseDoneAt > 0 ? nowMs() - responseDoneAt : Number.POSITIVE_INFINITY
    // Hard tail guard: ignore ASR in the first 500ms after assistant audio ends (echo).
    if (sinceDone < 500) {
      telemetry('transcript_ignored_post_response_tail', { sample: text.slice(0, 40), sinceDone })
      return false
    }
    // Reject transcripts that are the assistant answering itself.
    if (looksLikeAssistantEcho(text, lastAssistantSpoken)) {
      telemetry('transcript_ignored_assistant_echo', { sample: text.slice(0, 40) })
      return false
    }
    return true
  }

  const reassertTurnDetection = () => {
    const prefs = loadVoiceExperiencePrefs()
    const voice = mapPrefsToRealtimeVoice(prefs)
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            turn_detection: buildRealtimeTurnDetection(),
            transcription: transcriptionConfig(activeLanguage),
          },
          output: { voice },
        },
      },
    })
  }

  /**
   * Refresh multilingual + dialect instructions ONLY when idle (no active response).
   * Mid-response session.update was a root cause of Arabic→English mid-turn switches.
   */
  const refreshLanguageInstructionsIfIdle = (utterance?: string) => {
    if (hasCancellableResponse()) {
      telemetry('session_update_skipped_active_response', { utterance: utterance?.slice(0, 40) })
      return
    }
    const built = buildInstructions(utterance, activeLanguage)
    // Arabic session: never auto-switch to EN/CJK/etc from a short unclear fragment.
    const explicitSwitch = utterance
      ? /\b(?:speak|talk)\s+english\b|بالإنجليزي|بالانجليزي|English\s*please/i.test(utterance)
      : false
    if (
      (activeLanguage === 'ar' || activeLanguage == null)
      && built.language !== 'ar'
      && !explicitSwitch
    ) {
      activeLanguage = 'ar'
      sendEvent({
        type: 'session.update',
        session: {
          type: 'realtime',
          audio: {
            input: {
              transcription: transcriptionConfig('ar'),
              turn_detection: buildRealtimeTurnDetection(),
            },
          },
        },
      })
      return
    }
    // If assistant turn language is locked, keep speaking that language.
    if (assistantTurnLanguage && built.language !== assistantTurnLanguage) {
      // Explicit switch only applies after the current assistant turn finishes.
      return
    }
    activeLanguage = built.language
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: built.instructions,
        audio: {
          input: {
            transcription: transcriptionConfig(activeLanguage),
            turn_detection: buildRealtimeTurnDetection(),
          },
        },
      },
    })
  }

  const logAsrDiagnostics = (event: string, meta: Record<string, unknown>) => {
    logPipeline({
      stage: 'voice',
      event,
      meta: {
        conversationLanguage: activeLanguage,
        lockedUserTranscript,
        ...meta,
      },
    })
    telemetry(event, meta)
  }

  const utteranceAssembler = createArabicUtteranceAssembler({
    conversationLanguage: () => activeLanguage || 'ar',
    nowMs,
    commitDelayMs: ARABIC_UTTERANCE_COMMIT_MS,
    onCommit: (result: AssembledUtteranceCommit) => {
      if (hardStopped || disposed) return
      if (lockedUserTranscript != null) {
        logAsrDiagnostics('asr_commit_ignored_already_locked', {
          locked: lockedUserTranscript.slice(0, 80),
          attempted: result.committedTranscript.slice(0, 80),
        })
        return
      }
      if (!shouldAcceptTranscriptForResponse(result.committedTranscript)) {
        logAsrDiagnostics('asr_commit_rejected_echo_or_noise', {
          sample: result.committedTranscript.slice(0, 80),
          audioDurationMs: result.audioDurationMs,
        })
        utteranceAssembler.reset()
        return
      }
      lockedUserTranscript = result.committedTranscript
      transcriptGate.lockLanguage(activeLanguage === 'en' ? 'en' : 'ar')
      logAsrDiagnostics('asr_final_committed', {
        audioDurationMs: result.audioDurationMs,
        interimTranscript: result.interimTranscript.slice(0, 160),
        finalTranscript: result.committedTranscript.slice(0, 160),
        committedTranscript: result.committedTranscript.slice(0, 160),
        transcriptionCompletionReason: result.completionReason,
        normalizedForExtract: result.normalizedForExtract.slice(0, 160),
      })
      callbacks.onUserTranscript?.(result.committedTranscript, true, {
        committedTranscript: result.committedTranscript,
        normalizedForExtract: result.normalizedForExtract,
        audioDurationMs: result.audioDurationMs,
        completionReason: result.completionReason,
        conversationLanguage: result.conversationLanguage,
      })
      refreshLanguageInstructionsIfIdle(result.committedTranscript)
    },
    onReject: (result) => {
      if (hardStopped || disposed) return
      logAsrDiagnostics('asr_commit_rejected', {
        reason: result.reason,
        audioDurationMs: result.audioDurationMs,
        finalTranscript: result.transcript.slice(0, 120),
        transcriptionCompletionReason: result.completionReason,
      })
      const msg = activeLanguage === 'en' ? result.retryMessageEn : result.retryMessageAr
      callbacks.onAsrRetry?.(msg, {
        reason: result.reason,
        audioDurationMs: result.audioDurationMs,
      })
      if (!hasCancellableResponse()) setStatus('listening')
    },
  })

  const tearDownPeer = () => {
    try {
      dc?.close()
    } catch {
      // ignore
    }
    try {
      pc?.getSenders().forEach((s) => s.track?.stop())
      pc?.close()
    } catch {
      // ignore
    }
    try {
      localStream?.getTracks().forEach((t) => t.stop())
    } catch {
      // ignore
    }
    try {
      remoteAudio?.remove()
    } catch {
      // ignore
    }
    pc = null
    dc = null
    localStream = null
    remoteAudio = null
    remoteTrack = null
    assistantBuffer = ''
    // Keep Arabic-first default across soft reconnects.
    activeLanguage = activeLanguage || 'ar'
    clearActiveResponse()
    transcriptGate.resetTurn()
    utteranceAssembler.cancelPendingCommit()
    utteranceAssembler.reset()
    lockedUserTranscript = null
    lastAssistantSpoken = ''
    responseDoneAt = 0
    clientRequestedResponse = false
    clearPlaybackTimers()
  }

  const hardStopInternal = (reason: string) => {
    hardStopped = true
    sessionGeneration += 1
    clearPlaybackTimers()
    clientRequestedResponse = false
    utteranceAssembler.cancelPendingCommit()
    utteranceAssembler.reset()
    lockedUserTranscript = null
    logMicSessionState('STOPPED', { source: 'realtime', reason })
    telemetry('hard_stop', { reason })
    try {
      disableTurnDetection()
    } catch {
      // ignore
    }
    muteLocalMic()
    muteRemote(true)
    interruptInternal(false, { rearmMic: false })
    tearDownPeer()
    status = 'idle'
    logMicSessionState('IDLE', { source: 'realtime', reason: 'after_hard_stop' })
    callbacks.onStatus?.('idle')
    callbacks.onDisconnected?.()
  }

  /**
   * Cancel only when a response is actively generating or speaking.
   * Root cause of "Cancellation failed: no active response found":
   * every speech_started / disconnect previously sent response.cancel blindly.
   */
  const interruptInternal = (fromBargeIn = false, opts?: { rearmMic?: boolean }) => {
    const rearmMic = opts?.rearmMic !== false && !hardStopped
    const partial = assistantBuffer.trim()
    const wasSpeaking = status === 'speaking' || Boolean(activeResponse)
    const canCancel = hasCancellableResponse()
    const gen = sessionGeneration

    if (canCancel) {
      telemetry(fromBargeIn ? 'user_barge_in' : 'response_cancel_manual', {
        responseId: activeResponse?.id,
      })
      sendEvent({ type: 'response.cancel' })
      sendEvent({ type: 'output_audio_buffer.clear' })
      if (activeResponse) {
        activeResponse.cancelled = true
        telemetry('response_cancelled', { responseId: activeResponse.id, source: fromBargeIn ? 'barge_in' : 'manual' })
      }
      muteRemote(true)
      if (rearmMic) {
        queueMicrotask(() => {
          if (hardStopped || disposed || gen !== sessionGeneration) return
          muteRemote(false)
          ensureLocalMicLive()
        })
      }
    } else {
      // Skip network cancel entirely — harmless local no-op.
      telemetry('response_cancel_skipped_no_active', { fromBargeIn })
      if (rearmMic) ensureLocalMicLive()
    }

    if (fromBargeIn) {
      quality.markSpeechStarted(wasSpeaking)
    } else {
      quality.markManualInterrupt()
    }
    emitQuality()

    if (fromBargeIn && partial && canCancel) {
      callbacks.onInterrupted?.(partial)
      callbacks.onAssistantTranscript?.(partial, true)
    }
    if (canCancel) {
      assistantBuffer = ''
      clearActiveResponse()
    }
  }

  const maybeEnterListening = () => {
    /**
     * Listening resumes only after actual playback completion.
     * Do NOT use response.done alone — on WebRTC it fires before the output
     * buffer finishes draining (spoken cut short while text already shown).
     *
     * Preferred signal: output_audio_buffer.stopped
     * Fallback: audio stream done + short drain (if stopped event missing)
     * Text-only: response.done with no audio
     *
     * After hardStop: never re-enter listening (Stay IDLE until explicit connect).
     */
    if (hardStopped || disposed) {
      telemetry('enter_listening_blocked_hard_stopped')
      return
    }
    if (!activeResponse) {
      setStatus('listening')
      return
    }
    if (activeResponse.cancelled) {
      responseDoneAt = nowMs()
      clientRequestedResponse = false
      clearActiveResponse()
      if (hardStopped) return
      ensureLocalMicLive()
      reassertTurnDetection()
      setStatus('listening')
      telemetry('entered_idle_listening', { reason: 'cancelled' })
      return
    }

    if (activeResponse.hadAudio) {
      if (!activeResponse.playbackStopped) return
    } else if (!activeResponse.responseDone) {
      return
    }

    if (assistantBuffer.trim()) {
      lastAssistantSpoken = assistantBuffer.trim()
    }
    responseDoneAt = nowMs()
    clientRequestedResponse = false
    clearActiveResponse()
    if (hardStopped || disposed) return
    ensureLocalMicLive()
    reassertTurnDetection()
    setStatus('listening')
    telemetry('entered_idle_listening', { responseDoneAt, via: 'playback_complete' })
  }

  /** Fallback when output_audio_buffer.stopped is not delivered (<300ms target). */
  const schedulePlaybackFallback = () => {
    if (hardStopped) return
    clearPlaybackTimers()
    const gen = sessionGeneration
    playbackFallbackTimer = setTimeout(() => {
      playbackFallbackTimer = null
      if (hardStopped || disposed || gen !== sessionGeneration) return
      if (!activeResponse || activeResponse.cancelled) return
      if (activeResponse.playbackStopped) return
      // Only after server finished streaming audio.
      if (!activeResponse.audioStreamDone) return
      activeResponse.playbackStopped = true
      telemetry('playback_stopped_fallback', { responseId: activeResponse.id })
      maybeEnterListening()
    }, 180)
  }

  const handleServerEvent = (raw: string) => {
    if (hardStopped || disposed) return
    let event: {
      type?: string
      transcript?: string
      delta?: string
      response?: { id?: string }
      response_id?: string
      error?: { message?: string; code?: string }
    }
    try {
      event = JSON.parse(raw) as typeof event
    } catch {
      return
    }
    const type = event.type || ''

    if (type === 'error' || type === 'response.failed') {
      const message = event.error?.message || 'Realtime session error'
      if (isHarmlessRealtimeCancelError(message)) {
        // Private debug only — never UI, never error status.
        logChat('debug', 'voice', 'realtime_cancel_noop', { message })
        return
      }
      logChat('error', 'voice', 'realtime_server_error', { type, message })
      const facing = toUserFacingVoiceError(message) || VOICE_RECOVERABLE_ERROR_AR
      callbacks.onError?.(facing)
      setStatus('error')
      return
    }

    if (type === 'input_audio_buffer.speech_started') {
      // Only arm ASR assembly when idle/listening. Never while speaking —
      // echo must not clear state mid-playback.
      if (status === 'listening' || status === 'idle') {
        // New utterance after a prior commit — clear lock. Mid-pause continuation
        // keeps assembling (assembler cancels the commit timer).
        if (lockedUserTranscript != null && !utteranceAssembler.hasPending()) {
          lockedUserTranscript = null
          transcriptGate.resetTurn()
        } else if (!utteranceAssembler.hasPending()) {
          transcriptGate.resetTurn()
        }
        utteranceAssembler.onSpeechStarted(nowMs())
      }
      // NEVER auto-cancel on VAD while the assistant is speaking.
      // Root cause of cut-off audio: speaker echo → speech_started → cancel mid-reply
      // (server interrupt_response is also false). Real barge-in = mic tap → interrupt().
      quality.markSpeechStarted(status === 'speaking')
      emitQuality()
      telemetry('speech_started_no_auto_barge_in', {
        hadActive: Boolean(activeResponse),
        status,
        assembling: utteranceAssembler.hasPending(),
      })
      return
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      quality.markSpeechStopped()
      emitQuality()
      if (status === 'listening' || status === 'idle') {
        utteranceAssembler.onSpeechStopped(nowMs())
        // Debounced commit — brief Arabic pauses must not finalize mid-sentence.
        utteranceAssembler.scheduleCommit(ARABIC_UTTERANCE_COMMIT_MS)
      }
      // Stay listening — do NOT enter thinking or create a response on VAD alone.
      if (!hasCancellableResponse() && status !== 'speaking') {
        setStatus('listening')
      }
      telemetry('speech_stopped_no_auto_response', {
        status,
        assembling: utteranceAssembler.hasPending(),
      })
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      // Already committed — ignore later deltas (lock integrity).
      if (lockedUserTranscript != null) {
        logAsrDiagnostics('asr_delta_ignored_after_lock', { sample: event.delta.slice(0, 40) })
        return
      }
      const gated = transcriptGate.ingestDelta(event.delta)
      if (gated.displayText != null) {
        const display = utteranceAssembler.onInterim(gated.displayText)
        // Visual feedback only — never planner / memory.
        callbacks.onUserTranscript?.(display || gated.displayText, false)
        logAsrDiagnostics('asr_interim', {
          interimTranscript: (display || gated.displayText).slice(0, 160),
          audioDurationMs: utteranceAssembler.getAudioDurationMs(nowMs()),
        })
      }
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      // Locked turn — ignore late segment rewrites / translations.
      if (lockedUserTranscript != null) {
        logAsrDiagnostics('asr_segment_ignored_after_lock', {
          sample: event.transcript.slice(0, 40),
          locked: lockedUserTranscript.slice(0, 40),
        })
        return
      }
      // Validate segment (script / noise) without treating it as the planner commit.
      const gated = transcriptGate.ingestFinal(event.transcript)
      const exact = gated.exactText
      if (gated.accepted && exact) {
        // Unlock gate segment lock so pause-split segments can append.
        // Turn-level lock is `lockedUserTranscript` after silence commit.
        transcriptGate.resetTurn()
        // Keep Arabic transcription locked — do not adopt EN/CJK from a fragment.
        if (activeLanguage !== 'en') {
          activeLanguage = 'ar'
        }
        const display = utteranceAssembler.onSegmentFinal(exact)
        callbacks.onUserTranscript?.(display, false)
        logAsrDiagnostics('asr_segment_final', {
          segment: exact.slice(0, 120),
          assembled: display.slice(0, 160),
          audioDurationMs: utteranceAssembler.getAudioDurationMs(nowMs()),
        })
        // Schedule silence commit — do NOT hand off to planTurn yet.
        utteranceAssembler.scheduleCommit(ARABIC_UTTERANCE_COMMIT_MS)
      } else {
        logAsrDiagnostics('asr_segment_rejected', {
          accepted: gated.accepted,
          suppressed: gated.suppressed,
          sample: event.transcript.slice(0, 40),
        })
        if (!hasCancellableResponse()) setStatus('listening')
      }
      return
    }

    if (type === 'response.created') {
      const id = event.response?.id || event.response_id || `resp_${Date.now()}`
      if (!clientRequestedResponse) {
        telemetry('unsolicited_response_cancelled', { responseId: id })
        sendEvent({ type: 'response.cancel' })
        sendEvent({ type: 'output_audio_buffer.clear' })
        if (!hasCancellableResponse()) setStatus('listening')
        return
      }
      clientRequestedResponse = false
      const lang = activeLanguage || 'ar'
      assistantTurnLanguage = lang
      if (playbackFallbackTimer) {
        clearTimeout(playbackFallbackTimer)
        playbackFallbackTimer = null
      }
      activeResponse = {
        id,
        createdAt: nowMs(),
        audioStreamDone: false,
        playbackStopped: false,
        responseDone: false,
        cancelled: false,
        hadAudio: false,
        language: lang,
      }
      assistantBuffer = ''
      quality.markResponseCreated()
      emitQuality()
      telemetry('response_created', { responseId: id, language: lang })
      setStatus('thinking')
      return
    }

    if (type === 'output_audio_buffer.started') {
      if (activeResponse) {
        activeResponse.hadAudio = true
        quality.markFirstAssistantAudio()
        emitQuality()
        telemetry('response_audio_started', { responseId: activeResponse.id, via: 'output_buffer' })
      }
      setStatus('speaking')
      return
    }

    if (type === 'output_audio_buffer.stopped') {
      // WebRTC: buffer drained — this is actual playback completion.
      if (activeResponse) {
        activeResponse.hadAudio = true
        activeResponse.playbackStopped = true
        activeResponse.audioStreamDone = true
        telemetry('response_playback_stopped', { responseId: activeResponse.id })
      }
      if (playbackFallbackTimer) {
        clearTimeout(playbackFallbackTimer)
        playbackFallbackTimer = null
      }
      maybeEnterListening()
      return
    }

    if (
      type === 'response.output_audio.delta'
      || type === 'response.audio.delta'
    ) {
      if (activeResponse) {
        if (!activeResponse.hadAudio) {
          activeResponse.hadAudio = true
          quality.markFirstAssistantAudio()
          emitQuality()
          telemetry('response_audio_started', { responseId: activeResponse.id })
        }
      }
      setStatus('speaking')
      return
    }

    if (
      type === 'response.output_audio.done'
      || type === 'response.audio.done'
    ) {
      // Server finished *sending* audio — NOT playback complete yet.
      if (activeResponse) {
        activeResponse.hadAudio = true
        activeResponse.audioStreamDone = true
        telemetry('response_audio_stream_done', { responseId: activeResponse.id })
        schedulePlaybackFallback()
      }
      // Do NOT enter listening here — wait for output_audio_buffer.stopped.
      return
    }

    if (
      (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta')
      && typeof event.delta === 'string'
    ) {
      if (!assistantBuffer && activeResponse) {
        // Transcript may start before audio events — mark speaking but do NOT
        // treat as playback complete.
        quality.markFirstAssistantAudio()
        telemetry('response_audio_started', { responseId: activeResponse.id, via: 'transcript' })
        // Note: hadAudio set only on real audio events / buffer.started so
        // text-only responses can still complete via response.done.
      }
      assistantBuffer += event.delta
      callbacks.onAssistantTranscript?.(assistantBuffer, false)
      setStatus('speaking')
      return
    }

    if (
      type === 'response.output_audio_transcript.done'
      || type === 'response.audio_transcript.done'
    ) {
      // Finalize displayed text only — do NOT flip to listening.
      if (assistantBuffer) callbacks.onAssistantTranscript?.(assistantBuffer, true)
      return
    }

    if (type === 'response.done' || type === 'response.cancelled') {
      if (type === 'response.cancelled') {
        telemetry('response_cancelled', { responseId: activeResponse?.id, source: 'server' })
        if (activeResponse) activeResponse.cancelled = true
      }
      if (assistantBuffer) {
        callbacks.onAssistantTranscript?.(assistantBuffer, true)
        lastAssistantSpoken = assistantBuffer.trim()
      }
      assistantBuffer = ''
      if (activeResponse) {
        activeResponse.responseDone = true
        // WebRTC often omits audio.delta events (media track carries audio).
        // If we were speaking / have transcript, wait for playback drain — never
        // treat response.done alone as playback complete.
        if (status === 'speaking' || lastAssistantSpoken || assistantBuffer.length > 0) {
          activeResponse.hadAudio = true
          activeResponse.audioStreamDone = true
          if (!activeResponse.playbackStopped) schedulePlaybackFallback()
        } else if (!activeResponse.hadAudio) {
          activeResponse.playbackStopped = true
        } else if (activeResponse.audioStreamDone && !activeResponse.playbackStopped) {
          schedulePlaybackFallback()
        }
      }
      quality.markResponseDone()
      emitQuality()
      telemetry('response_done', {
        responseId: activeResponse?.id,
        hadAudio: activeResponse?.hadAudio ?? false,
        playbackStopped: activeResponse?.playbackStopped ?? false,
        cancelled: type === 'response.cancelled',
      })
      logChat('debug', 'voice', 'realtime_quality', quality.snapshot() as unknown as Record<string, unknown>)
      maybeEnterListening()
      return
    }
  }

  return {
    getStatus: () => status,
    isConnected: () => Boolean(pc && dc && dc.readyState === 'open'),
    getQualitySnapshot: () => quality.snapshot(),
    async connect() {
      if (disposed) return
      // Explicit user start — clear hard Stop latch; lock Arabic transcription.
      hardStopped = false
      sessionGeneration += 1
      activeLanguage = 'ar'
      lockedUserTranscript = null
      utteranceAssembler.reset()
      transcriptGate.resetTurn()
      clearPlaybackTimers()
      // Allow reconnect after a clean disconnect on the same session object.
      if (pc && dc && dc.readyState === 'open') {
        ensureLocalMicLive()
        reassertTurnDetection()
        setStatus('listening')
        return
      }
      if (pc) {
        tearDownPeer()
      }
      setStatus('connecting')

      const prefs = loadVoiceExperiencePrefs()
      const voice = mapPrefsToRealtimeVoice(prefs)

      pc = new RTCPeerConnection()
      remoteAudio = document.createElement('audio')
      remoteAudio.autoplay = true
      remoteAudio.setAttribute('playsinline', 'true')
      remoteAudio.style.display = 'none'
      document.body.appendChild(remoteAudio)

      pc.ontrack = (e) => {
        if (!remoteAudio) return
        const stream = e.streams[0] ?? null
        remoteAudio.srcObject = stream
        remoteTrack = stream?.getAudioTracks()?.[0] ?? e.track ?? null
        void remoteAudio.play().catch(() => {
          quality.markAudioRestart()
          emitQuality()
        })
        setStatus('listening')
      }

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream)
      }

      dc = pc.createDataChannel('oai-events')
      dc.onmessage = (ev) => {
        if (typeof ev.data === 'string') handleServerEvent(ev.data)
      }
      dc.onopen = () => {
        const built = buildInstructions(undefined, activeLanguage)
        activeLanguage = built.language
        // Enable input transcription with language hint + ChatGPT-Voice-like turn detection.
        sendEvent({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: built.instructions,
            audio: {
              input: {
                transcription: transcriptionConfig(activeLanguage),
                turn_detection: buildRealtimeTurnDetection(),
              },
              output: { voice },
            },
          },
        })
        quality.markSessionConnected()
        callbacks.onConnected?.()
        setStatus('listening')
        logChat('debug', 'voice', 'realtime_connected', {
          model: REALTIME_PUBLIC_MODEL,
          voice,
          turnDetection: 'semantic_vad',
          language: activeLanguage,
          transcriptionLanguage: transcriptionLanguageHint(activeLanguage),
        })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const initial = buildInstructions(undefined, activeLanguage)
      activeLanguage = initial.language
      const res = await fetch('/api/openai/realtime-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          voice,
          instructions: initial.instructions,
          dialectHint: dialectChatGuidance(prefs.dialect),
        }),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        logChat('error', 'voice', 'realtime_call_failed', {
          status: res.status,
          detail: detail.slice(0, 400),
        })
        callbacks.onError?.(VOICE_RECOVERABLE_ERROR_AR)
        setStatus('error')
        tearDownPeer()
        throw new Error(`realtime_call_failed:${res.status}`)
      }

      const answerSdp = await res.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    },
    disconnect() {
      // Soft end used by non-Stop paths (e.g. greeting wipe). Still latch hardStopped
      // so no pending playback callback can reopen listening until explicit connect().
      hardStopInternal('disconnect')
    },
    hardStop() {
      hardStopInternal('user_stop')
    },
    dispose() {
      disposed = true
      hardStopped = true
      sessionGeneration += 1
      clearPlaybackTimers()
      interruptInternal(false, { rearmMic: false })
      tearDownPeer()
      status = 'idle'
      logMicSessionState('IDLE', { source: 'realtime', reason: 'dispose' })
      callbacks.onStatus?.('idle')
      callbacks.onDisconnected?.()
    },
    ensureListening() {
      if (disposed || hardStopped) {
        telemetry('ensure_listening_blocked', { disposed, hardStopped })
        return
      }
      if (!pc || !dc || dc.readyState !== 'open') return
      // Never force listening while an assistant response is still speaking.
      if (hasCancellableResponse() && status === 'speaking') return
      ensureLocalMicLive()
      reassertTurnDetection()
      muteRemote(false)
      if (status !== 'listening') setStatus('listening')
    },
    isHardStopped() {
      return hardStopped
    },
    interrupt() {
      if (hardStopped || disposed) return
      // Explicit user barge-in (mic tap) — always allowed when a response is active.
      interruptInternal(true, { rearmMic: true })
      ensureLocalMicLive()
      setStatus('listening')
    },
    sendText(text: string) {
      // Architecture: text turns are owned by planTurn (HomeVoiceConsultant).
      // Realtime must not create a parallel spoken reply from sendText.
      const cleaned = text.trim()
      if (!cleaned) return
      telemetry('send_text_ignored_turn_owner_is_plan_turn', { sample: cleaned.slice(0, 40) })
      if (!hardStopped) setStatus('listening')
    },
    speakWrittenDraft(written, opts) {
      if (hardStopped || disposed) {
        telemetry('speak_blocked_hard_stopped')
        return
      }
      const locale = opts?.locale === 'en' ? 'en' : 'ar'
      // Sole Realtime speech path — speak the same text the UI shows.
      // Strip advice/website chrome only; do not invent a shorter second reply.
      const cleaned = toSpokenDialogue(written, {
        locale,
        maxChars: Math.max(280, written.trim().length),
        context: inferSpokenContext(written),
      })
      const spoken = (cleaned || written).replace(/\s+/g, ' ').trim()
      if (!spoken) return
      if (locale === 'ar') activeLanguage = 'ar'
      else if (locale === 'en') activeLanguage = 'en'
      const context = inferSpokenContext(spoken)
      assistantBuffer = ''
      setStatus('thinking')
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: [
              'Speak the following booking-agent dialogue aloud now, VERBATIM — every sentence to the end.',
              `Language lock: speak only in ${locale === 'ar' ? 'Arabic' : 'English'}. Do not switch languages.`,
              spokenToneCue(context),
              'Do not expand, advise, lecture, or add website referrals.',
              'Do not add extra questions beyond what is written.',
              'Do not stop mid-sentence. Do not continue after the dialogue ends.',
              `DIALOGUE: ${spoken}`,
            ].join('\n'),
          }],
        },
      })
      requestAssistantResponse('speak_written_draft')
      // Do not rewrite the on-screen reply with a different shortened string.
      callbacks.onAssistantTranscript?.(spoken, false)
    },
  }
}
