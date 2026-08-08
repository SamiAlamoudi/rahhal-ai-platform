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
  detectConversationLanguage,
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
import { emptyVoicePlaybackDiagnostics } from '../../bilamo/voice/voicePlaybackDiagnostics'
import {
  obtainPrimedRemoteAudioElement,
  resumeSharedAudioContext,
  unlockAudioPlayback,
} from './audioElementTextToSpeechProvider'
import { BILAMO_TRANSCRIPTION_PROMPT } from './bilamoBrandAsr'
import { noteVoiceLifecycleStage } from '../../bilamo/voice/voiceHttpTrace'
import {
  ARABIC_UTTERANCE_COMMIT_MS,
  createArabicUtteranceAssembler,
  type AssembledUtteranceCommit,
} from './arabicUtteranceAssembler'
import { createVoiceCaptureAudit } from './voiceCaptureAudit'
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
  /** Pre-sanitize ASR for diagnostics. */
  rawTranscript?: string
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

export type RealtimeConnectOptions = {
  /** Mic acquired inside the originating user gesture — required on iPhone Safari. */
  localStream?: MediaStream | null
}

export type RealtimeWebRtcSession = {
  connect: (options?: RealtimeConnectOptions) => Promise<void>
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
   * Re-arm mic + turn detection after an explicit user mic press.
   * Safe no-op when not connected or after hardStop.
   * Does not auto-run after assistant playback — that path releases the mic to idle.
   */
  ensureListening: () => Promise<boolean>
  /**
   * Stop local mic capture and return to idle without latching hardStop.
   * Clears the iOS Safari mic indicator; peer/datachannel may stay up for fast reopen.
   */
  releaseToIdle: (reason?: string) => void
  /**
   * End-of-speech finalize: commit pending ASR once (includes interim).
   * Does not cancel a pending silence commit. Does not auto-relisten.
   */
  finalizeListening: () => void
  /** True after hardStop until the next explicit connect(). */
  isHardStopped: () => boolean
  /** Send a text user turn into the live session (no classic TTS). */
  sendText: (text: string) => void
  /**
   * Speak a written assistant draft via Realtime after spoken-dialogue post-processing.
   * Does not change the Realtime engine — only the words fed into it.
   */
  speakWrittenDraft: (written: string, opts?: { locale?: LockedSpeechLanguage }) => void
  /**
   * Set ASR / conversation input language before listening.
   * Must be called with the traveler's language — connect must not force Arabic
   * when another language is already preferred.
   */
  setInputLanguage: (language: LockedSpeechLanguage) => void
  getStatus: () => RealtimeSessionStatus
  isConnected: () => boolean
  getQualitySnapshot: () => RealtimeQualitySnapshot
  /** Developer-safe playback diagnostics (no transcripts / secrets). */
  getPlaybackDiagnostics: () => import('../../bilamo/voice/voicePlaybackDiagnostics').VoicePlaybackDiagnostics
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
  return {
    model: 'gpt-4o-mini-transcribe' as const,
    language: hint,
    prompt: BILAMO_TRANSCRIPTION_PROMPT,
  }
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
  /** Preferred ASR language from Bilamo UI (survives connect; includes French). */
  let preferredInputLanguage: LockedSpeechLanguage | null = null
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
  const captureAudit = createVoiceCaptureAudit()
  /** Brief ICE blip timer — avoid tearing down on mobile transient disconnects. */
  let iceRecoveryTimer: ReturnType<typeof setTimeout> | null = null
  /** Queue progressive speakWrittenDraft chunks while a response is already playing. */
  let speakQueue: Array<{ spoken: string; locale: LockedSpeechLanguage }> = []
  const playbackDiag = emptyVoicePlaybackDiagnostics()

  const applyInputLanguage = (language: LockedSpeechLanguage, reason: string) => {
    preferredInputLanguage = language
    activeLanguage = language
    telemetry('input_language_set', { language, reason })
    if (!dc || dc.readyState !== 'open' || hasCancellableResponse()) return
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            transcription: transcriptionConfig(language),
            turn_detection: buildRealtimeTurnDetection(),
          },
        },
      },
    })
  }

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
    if (iceRecoveryTimer) {
      clearTimeout(iceRecoveryTimer)
      iceRecoveryTimer = null
    }
  }

  const rejectTurnForTransport = (reason: string) => {
    utteranceAssembler.cancelPendingCommit()
    utteranceAssembler.reset()
    lockedUserTranscript = null
    const audit = captureAudit.snapshot()
    logPipeline({
      stage: 'voice',
      event: 'voice_capture_transport_reject',
      meta: { reason, ...audit },
    })
    const msg = activeLanguage === 'en'
      ? 'The microphone connection dropped. Please say the full request again.'
      : 'انقطع اتصال الميكروفون. عِد طلب الحجز كامل من فضلك.'
    callbacks.onAsrRetry?.(msg, { reason, ...audit })
    if (!hasCancellableResponse()) setStatus('listening')
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

  const hasLiveMicTrack = (): boolean => {
    try {
      if (localStream?.getAudioTracks().some((t) => t.readyState === 'live')) return true
      return Boolean(
        pc?.getSenders().some(
          (s) => s.track?.kind === 'audio' && s.track.readyState === 'live',
        ),
      )
    } catch {
      return false
    }
  }

  /**
   * Fully stop local capture so iOS Safari clears the red/orange mic indicator.
   * Keeps the RTCPeerConnection / data channel for faster next user tap.
   */
  const stopLocalMicCapture = (reason: string) => {
    try {
      disableTurnDetection()
    } catch {
      // ignore
    }
    utteranceAssembler.cancelPendingCommit()
    muteLocalMic()
    try {
      localStream?.getTracks().forEach((t) => t.stop())
    } catch {
      // ignore
    }
    try {
      pc?.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') {
          try {
            sender.track.stop()
          } catch {
            // ignore
          }
          try {
            void sender.replaceTrack(null)
          } catch {
            // ignore
          }
        }
      })
    } catch {
      // ignore
    }
    localStream = null
    captureAudit.releaseMicMonitor()
    telemetry('mic_capture_released', { reason, status })
    logPipeline({
      stage: 'microphone',
      event: 'mic_capture_released',
      meta: { reason, status },
    })
  }

  const acquireLocalMic = async (): Promise<boolean> => {
    if (hardStopped || disposed || !pc) return false
    if (hasLiveMicTrack()) {
      ensureLocalMicLive()
      return true
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      if (hardStopped || disposed || !pc) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }
      localStream = stream
      captureAudit.attachLocalStream(stream)
      const track = stream.getAudioTracks()[0]
      if (track) {
        try {
          if ('contentHint' in track) {
            ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
          }
        } catch {
          // ignore
        }
        const audioSender = pc.getSenders().find(
          (s) => s.track?.kind === 'audio' || s.track == null || s.track.readyState === 'ended',
        )
        if (audioSender && typeof audioSender.replaceTrack === 'function') {
          await audioSender.replaceTrack(track)
        } else {
          pc.addTrack(track, stream)
        }
      }
      ensureLocalMicLive()
      telemetry('mic_capture_acquired', { sampleRate: track?.getSettings?.().sampleRate ?? null })
      return true
    } catch (error) {
      telemetry('mic_reacquire_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  const releaseToIdleInternal = (reason: string) => {
    if (disposed) return
    stopLocalMicCapture(reason)
    clearPlaybackTimers()
    status = 'idle'
    logMicSessionState('IDLE', { source: 'realtime', reason: `mic_released:${reason}` })
    callbacks.onStatus?.('idle')
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

  /**
   * Stop audible remote playback without latching the MediaStreamTrack muted.
   * Historically muteRemote(true) set remoteTrack.enabled=false and, when
   * rearmMic was false (send barge-in / interrupt), never re-enabled it — so the
   * next speakWrittenDraft produced silent "speaking" with no audible audio.
   */
  const stopRemotePlayback = () => {
    try {
      if (remoteAudio) {
        remoteAudio.pause()
        try {
          remoteAudio.currentTime = 0
        } catch {
          /* ignore */
        }
      }
      // Keep the track live so the next assistant response can play.
      if (remoteTrack) remoteTrack.enabled = true
    } catch {
      // ignore
    }
  }

  /**
   * Wait for real playback evidence — play() resolve alone is insufficient on Safari.
   * MediaStream currentTime often stays 0; prefer `playing` / unmuted+!paused+live track.
   */
  const waitForRemotePlaybackEvidence = (el: HTMLAudioElement, timeoutMs = 1800): Promise<boolean> => {
    // currentTime often stays 0 for MediaStream — require playing event or timeupdate.
    if (el.currentTime > 0.02 && !el.paused && !el.muted) return Promise.resolve(true)
    return new Promise((resolve) => {
      let done = false
      let sawPlaying = false
      const finish = (ok: boolean) => {
        if (done) return
        done = true
        el.removeEventListener('playing', onPlaying)
        el.removeEventListener('timeupdate', onTime)
        clearTimeout(timer)
        resolve(ok)
      }
      const onPlaying = () => {
        sawPlaying = true
        if (!el.muted && el.volume > 0 && el.srcObject) finish(true)
      }
      const onTime = () => {
        if (el.currentTime > 0.02) finish(true)
      }
      const timer = globalThis.setTimeout(() => {
        // Timeout: accept only if playing fired (WebRTC) or currentTime advanced.
        const ok = (sawPlaying || el.currentTime > 0.02)
          && !el.paused
          && !el.muted
          && el.volume > 0
          && Boolean(el.srcObject)
          && (!remoteTrack || (remoteTrack.readyState === 'live' && !remoteTrack.muted))
        finish(ok)
      }, timeoutMs)
      el.addEventListener('playing', onPlaying)
      el.addEventListener('timeupdate', onTime)
    })
  }

  const ensureRemoteAudible = async (): Promise<boolean> => {
    if (!remoteAudio) {
      playbackDiag.audioElementAttached = false
      playbackDiag.playResult = 'rejected'
      playbackDiag.lastEvent = 'playRejected'
      playbackDiag.lastSafeErrorCode = 'no_audio_element'
      playbackDiag.audible = false
      return false
    }
    playbackDiag.audioElementAttached = Boolean(remoteAudio.srcObject)
    playbackDiag.audioPlayRequested = true
    playbackDiag.playResult = 'pending'
    playbackDiag.lastEvent = 'PLAY_CALLED'
    noteVoiceLifecycleStage('PLAY_CALLED')
    playbackDiag.audible = false
    try {
      if (remoteTrack) {
        remoteTrack.enabled = true
        playbackDiag.remoteTrackReadyState = remoteTrack.readyState
        playbackDiag.remoteTrackMuted = remoteTrack.muted
      }
      remoteAudio.autoplay = true
      remoteAudio.setAttribute('playsinline', 'true')
      remoteAudio.setAttribute('webkit-playsinline', 'true')
      remoteAudio.muted = false
      remoteAudio.volume = 1
      // Resume AudioContext only — NEVER full unlock (would wipe srcObject via silent WAV).
      try {
        await resumeSharedAudioContext()
      } catch {
        /* ignore */
      }
      const isRealMediaElement = typeof remoteAudio.addEventListener === 'function'
      if (!remoteAudio.srcObject && isRealMediaElement) {
        playbackDiag.playResult = 'rejected'
        playbackDiag.audioPlaybackFailed = true
        playbackDiag.lastEvent = 'playRejected'
        playbackDiag.lastSafeErrorCode = 'no_remote_src_object'
        noteVoiceLifecycleStage('REALTIME_AUDIO_FAILED', { code: 'NO_REMOTE_SRC' })
        return false
      }
      if (remoteTrack && (remoteTrack.readyState === 'ended' || remoteTrack.muted)) {
        playbackDiag.playResult = 'rejected'
        playbackDiag.audioPlaybackFailed = true
        playbackDiag.lastEvent = 'playRejected'
        playbackDiag.lastSafeErrorCode = 'remote_track_not_live'
        noteVoiceLifecycleStage('REALTIME_AUDIO_FAILED', { code: 'REMOTE_TRACK_NOT_LIVE' })
        return false
      }
      if (remoteTrack) remoteTrack.enabled = true
      await remoteAudio.play()
      if (remoteAudio.muted || remoteAudio.volume === 0) {
        playbackDiag.playResult = 'rejected'
        playbackDiag.audioPlaybackFailed = true
        playbackDiag.lastEvent = 'playRejected'
        playbackDiag.lastSafeErrorCode = 'play_resolved_but_silent'
        noteVoiceLifecycleStage('REALTIME_AUDIO_FAILED', { code: 'PLAY_SILENT' })
        return false
      }
      playbackDiag.playResult = 'resolved'
      // Real Safari/DOM audio: require playing/timeupdate. Test stubs lack addEventListener.
      if (isRealMediaElement) {
        const progressed = await waitForRemotePlaybackEvidence(remoteAudio, 1800)
        if (!progressed) {
          playbackDiag.audioPlaybackStarted = false
          playbackDiag.audible = false
          playbackDiag.audioPlaybackFailed = true
          playbackDiag.lastEvent = 'playRejected'
          playbackDiag.lastSafeErrorCode = 'play_resolved_no_progression'
          noteVoiceLifecycleStage('REALTIME_AUDIO_FAILED', { code: 'NO_PROGRESSION' })
          return false
        }
      }
      playbackDiag.audioPlaybackStarted = true
      playbackDiag.audible = true
      playbackDiag.audioPlaybackFailed = false
      playbackDiag.lastEvent = 'ACTUAL_PLAYBACK_STARTED'
      noteVoiceLifecycleStage('ACTUAL_PLAYBACK_STARTED')
      return true
    } catch (err) {
      const name = err instanceof Error ? err.name : 'play_error'
      playbackDiag.playResult = 'rejected'
      playbackDiag.audioPlaybackFailed = true
      playbackDiag.audible = false
      playbackDiag.lastEvent = 'playRejected'
      playbackDiag.lastSafeErrorCode =
        name === 'NotAllowedError' || name === 'AbortError'
          ? name
          : 'playback_blocked'
      noteVoiceLifecycleStage('REALTIME_AUDIO_FAILED', {
        code: playbackDiag.lastSafeErrorCode?.toUpperCase?.() || 'PLAYBACK_BLOCKED',
      })
      quality.markAudioRestart()
      emitQuality()
      // Structured recovery is owned by BilamoVoiceSession (reconnect → classic TTS).
      callbacks.onError?.('تعذر تشغيل الصوت.')
      return false
    }
  }

  /** Enter speaking only after remote audio is actually playing (Safari-safe). */
  const enterSpeakingIfAudible = (via: string) => {
    if (hardStopped || disposed) return
    void ensureRemoteAudible().then((ok) => {
      if (hardStopped || disposed) return
      if (!ok) {
        // Do not latch speaking — stay thinking/idle so VoiceSession can fall back.
        if (status === 'speaking') {
          releaseToIdleInternal('playback_blocked')
        }
        return
      }
      telemetry('response_audible_speaking', { via })
      setStatus('speaking')
    })
  }

  const muteRemote = (muted: boolean) => {
    try {
      if (remoteAudio) {
        if (muted) {
          remoteAudio.pause()
          try {
            remoteAudio.currentTime = 0
          } catch {
            /* ignore */
          }
        } else {
          if (remoteTrack) remoteTrack.enabled = true
          void remoteAudio.play().catch(() => undefined)
        }
      }
      // Only disable the track on hard teardown paths that call muteRemote(true)
      // immediately before tearDownPeer. Interrupt/barge-in must use stopRemotePlayback.
      if (muted && (hardStopped || disposed)) {
        if (remoteTrack) remoteTrack.enabled = false
      } else if (!muted && remoteTrack) {
        remoteTrack.enabled = true
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
    playbackDiag.realtimeAudioRequested = true
    playbackDiag.assistantResponseCreated = true
    noteVoiceLifecycleStage('REALTIME_AUDIO_REQUESTED')
    // Must request audio output — bare response.create can yield text-only
    // (transcript events without remote track audio → silent device).
    sendEvent({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
      },
    })
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
    // Arabic session: never auto-switch to CJK/etc from a short unclear fragment.
    // Confident Latin FR/EN must be allowed — forcing `ar` here broke French ASR.
    const explicitSwitch = utterance
      ? /\b(?:speak|talk)\s+english\b|بالإنجليزي|بالانجليزي|English\s*please|en français|parlons français/i.test(utterance)
      : false
    const detected = utterance ? detectConversationLanguage(utterance) : null
    const allowLatinSwitch = Boolean(
      detected
      && detected.confidence >= 0.4
      && (detected.language === 'en' || detected.language === 'fr'),
    )
    if (
      (activeLanguage === 'ar' || activeLanguage == null)
      && built.language !== 'ar'
      && !explicitSwitch
      && !allowLatinSwitch
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
      const capture = captureAudit.endTurn({
        finalTranscript: result.committedTranscript,
        assemblerAudioDurationMs: result.audioDurationMs,
      })
      if (lockedUserTranscript != null) {
        logAsrDiagnostics('asr_commit_ignored_already_locked', {
          locked: lockedUserTranscript.slice(0, 80),
          attempted: result.committedTranscript.slice(0, 80),
        })
        return
      }
      // Transport incomplete → soft retry; do not compensate with transcript logic.
      if (
        capture.partialCause === 'missing_audio_transport'
        || capture.shrinkStage === 'webrtc_transport'
      ) {
        logAsrDiagnostics('asr_commit_rejected_transport', {
          sample: result.committedTranscript.slice(0, 80),
          audioDurationMs: result.audioDurationMs,
          ...capture,
        })
        utteranceAssembler.reset()
        const msg = activeLanguage === 'en'
          ? 'Audio upload was incomplete. Please repeat the full booking sentence.'
          : 'رفع الصوت ما اكتمل. عِد جملة الحجز كاملة من فضلك.'
        callbacks.onAsrRetry?.(msg, { reason: 'missing_audio_transport', ...capture })
        if (!hasCancellableResponse()) setStatus('listening')
        return
      }
      if (!shouldAcceptTranscriptForResponse(result.committedTranscript)) {
        logAsrDiagnostics('asr_commit_rejected_echo_or_noise', {
          sample: result.committedTranscript.slice(0, 80),
          audioDurationMs: result.audioDurationMs,
          capturePartialCause: capture.partialCause,
        })
        utteranceAssembler.reset()
        return
      }
      lockedUserTranscript = result.committedTranscript
      transcriptGate.lockLanguage(
        activeLanguage === 'en' || activeLanguage === 'fr' ? activeLanguage : 'ar',
      )
      logAsrDiagnostics('asr_final_committed', {
        audioDurationMs: result.audioDurationMs,
        interimTranscript: result.interimTranscript.slice(0, 160),
        finalTranscript: result.committedTranscript.slice(0, 160),
        committedTranscript: result.committedTranscript.slice(0, 160),
        transcriptionCompletionReason: result.completionReason,
        normalizedForExtract: result.normalizedForExtract.slice(0, 160),
        microphoneRecordingDurationMs: capture.microphoneRecordingDurationMs,
        serverVadDurationMs: capture.serverVadDurationMs,
        sampleRate: capture.sampleRate,
        audioFrameCount: capture.audioFrameCount,
        droppedFrames: capture.droppedFrames,
        packetsLostDelta: capture.packetsLostDelta,
        bytesSentDelta: capture.bytesSentDelta,
        peakAudioEnergy: capture.peakAudioEnergy,
        realtimeReconnects: capture.realtimeReconnects,
        serverReceivedCommittedAudio: capture.serverReceivedCommittedAudio,
        shrinkStage: capture.shrinkStage,
        partialCause: capture.partialCause,
      })
      // Close mic immediately on commit — do not keep capturing during planTurn/playback.
      stopLocalMicCapture('asr_final_committed')
      setStatus('thinking')
      callbacks.onUserTranscript?.(result.committedTranscript, true, {
        committedTranscript: result.committedTranscript,
        rawTranscript: result.rawTranscript,
        normalizedForExtract: result.normalizedForExtract,
        audioDurationMs: result.audioDurationMs,
        completionReason: result.completionReason,
        conversationLanguage: result.conversationLanguage,
      })
      refreshLanguageInstructionsIfIdle(result.committedTranscript)
    },
    onReject: (result) => {
      if (hardStopped || disposed) return
      const capture = captureAudit.endTurn({
        finalTranscript: result.transcript,
        assemblerAudioDurationMs: result.audioDurationMs,
      })
      logAsrDiagnostics('asr_commit_rejected', {
        reason: result.reason,
        audioDurationMs: result.audioDurationMs,
        finalTranscript: result.transcript.slice(0, 120),
        transcriptionCompletionReason: result.completionReason,
        shrinkStage: capture.shrinkStage,
        partialCause: capture.partialCause,
        microphoneRecordingDurationMs: capture.microphoneRecordingDurationMs,
        serverVadDurationMs: capture.serverVadDurationMs,
        packetsLostDelta: capture.packetsLostDelta,
        bytesSentDelta: capture.bytesSentDelta,
        realtimeReconnects: capture.realtimeReconnects,
        serverReceivedCommittedAudio: capture.serverReceivedCommittedAudio,
      })
      const transportMsg = activeLanguage === 'en'
        ? 'Audio upload was incomplete. Please repeat the full booking sentence.'
        : 'رفع الصوت ما اكتمل. عِد جملة الحجز كاملة من فضلك.'
      const msg = capture.partialCause === 'missing_audio_transport'
        ? transportMsg
        : (activeLanguage === 'en' ? result.retryMessageEn : result.retryMessageAr)
      callbacks.onAsrRetry?.(msg, {
        reason: result.reason,
        audioDurationMs: result.audioDurationMs,
        partialCause: capture.partialCause,
      })
      if (!hasCancellableResponse()) setStatus('listening')
    },
  })

  const tearDownPeer = () => {
    captureAudit.dispose()
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
      // Detach stream only — keep the shared primed <audio> in DOM for Safari unlock.
      if (remoteAudio) {
        remoteAudio.pause()
        remoteAudio.srcObject = null
      }
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
    speakQueue = []
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
      // Stop current audio but keep the remote track enabled for the next reply.
      stopRemotePlayback()
      if (rearmMic) {
        queueMicrotask(() => {
          if (hardStopped || disposed || gen !== sessionGeneration) return
          void ensureRemoteAudible()
          ensureLocalMicLive()
        })
      }
    } else {
      // Skip network cancel entirely — harmless local no-op.
      telemetry('response_cancel_skipped_no_active', { fromBargeIn })
      // Still clear any residual latch so a later speak can be heard.
      stopRemotePlayback()
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

  const languageLabelFor = (locale: LockedSpeechLanguage): string => {
    const map: Partial<Record<LockedSpeechLanguage, string>> = {
      ar: 'Arabic',
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      de: 'German',
      it: 'Italian',
      tr: 'Turkish',
      hi: 'Hindi',
      ur: 'Urdu',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      pt: 'Portuguese',
      ru: 'Russian',
      id: 'Indonesian',
    }
    return map[locale] || 'English'
  }

  const startSpeakUtterance = (spoken: string, locale: LockedSpeechLanguage) => {
    // Speaking must never overlap local capture (no Listening + Speaking).
    stopLocalMicCapture('speak_written_draft')
    activeLanguage = locale
    preferredInputLanguage = locale
    const context = inferSpokenContext(spoken)
    const languageLabel = languageLabelFor(locale)
    assistantBuffer = ''
    // Fresh play diagnostics for this assistant utterance (same text as UI — no second answer).
    playbackDiag.audioPlayRequested = false
    playbackDiag.audioPlaybackStarted = false
    playbackDiag.audioPlaybackFailed = false
    playbackDiag.audioPlaybackEnded = false
    playbackDiag.playResult = null
    playbackDiag.assistantResponseCreated = false
    // Ensure prior interrupt did not leave the remote track muted.
    if (remoteTrack) {
      remoteTrack.enabled = true
      playbackDiag.remoteTrackReadyState = remoteTrack.readyState
      playbackDiag.remoteTrackMuted = remoteTrack.muted
    }
    if (remoteAudio) {
      remoteAudio.autoplay = true
      remoteAudio.setAttribute('playsinline', 'true')
      remoteAudio.setAttribute('webkit-playsinline', 'true')
      remoteAudio.muted = false
      remoteAudio.volume = 1
      playbackDiag.audioElementAttached = Boolean(remoteAudio.srcObject)
      // Do NOT call ensureRemoteAudible here — that previously false-latched
      // audioPlaybackStarted on bare play() before output_audio_buffer.started.
      // SPEAKING waits for enterSpeakingIfAudible after audio buffer / delta.
    }
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
            `Language lock: speak only in ${languageLabel}. Do not switch languages.`,
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
    callbacks.onAssistantTranscript?.(spoken, false)
  }

  const flushSpeakQueue = () => {
    if (hardStopped || disposed) {
      speakQueue = []
      return false
    }
    if (hasCancellableResponse()) return false
    const next = speakQueue.shift()
    if (!next) return false
    telemetry('speak_queue_flush', { remaining: speakQueue.length, sample: next.spoken.slice(0, 40) })
    startSpeakUtterance(next.spoken, next.locale)
    return true
  }

  const maybeEnterListening = () => {
    /**
     * After playback completion: release the mic to IDLE.
     * Do NOT auto-reopen listening — iPhone users see a stuck red mic indicator
     * and a second partial turn can start while results are already on screen.
     * Next listen requires an explicit mic tap (ensureListening / connect).
     *
     * Preferred signal: output_audio_buffer.stopped
     * Fallback: audio stream done + short drain (if stopped event missing)
     * Text-only: response.done with no audio
     */
    if (hardStopped || disposed) {
      telemetry('enter_listening_blocked_hard_stopped')
      return
    }
    if (!activeResponse) {
      if (flushSpeakQueue()) return
      releaseToIdleInternal('no_active_response')
      telemetry('entered_idle_mic_released', { reason: 'no_active_response' })
      return
    }
    if (activeResponse.cancelled) {
      responseDoneAt = nowMs()
      clientRequestedResponse = false
      clearActiveResponse()
      if (hardStopped) return
      if (flushSpeakQueue()) return
      releaseToIdleInternal('response_cancelled')
      telemetry('entered_idle_mic_released', { reason: 'cancelled' })
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
    // Progressive speech: play queued tail before releasing to idle.
    if (flushSpeakQueue()) return
    releaseToIdleInternal('playback_complete')
    telemetry('entered_idle_mic_released', { responseDoneAt, via: 'playback_complete' })
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
      // Only arm ASR while actively listening. Idle = mic released — ignore VAD.
      // Never while speaking — echo must not clear state mid-playback.
      if (status === 'listening') {
        // New utterance after a prior commit — clear lock. Mid-pause continuation
        // keeps assembling (assembler cancels the commit timer).
        if (lockedUserTranscript != null && !utteranceAssembler.hasPending()) {
          lockedUserTranscript = null
          transcriptGate.resetTurn()
        } else if (!utteranceAssembler.hasPending()) {
          transcriptGate.resetTurn()
        }
        const at = nowMs()
        captureAudit.onSpeechStarted(at)
        utteranceAssembler.onSpeechStarted(at)
        playbackDiag.speechDetected = true
        playbackDiag.lastEvent = 'speechDetected'
        // Keep mic unmuted for the entire utterance (transport integrity).
        ensureLocalMicLive()
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
        capture: captureAudit.snapshot(),
      })
      return
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      const at = nowMs()
      captureAudit.onSpeechStopped(at)
      if (status === 'listening') {
        playbackDiag.endOfSpeechDetected = true
        playbackDiag.lastEvent = 'endOfSpeechDetected'
      }
      quality.markSpeechStopped()
      emitQuality()
      if (status === 'listening') {
        utteranceAssembler.onSpeechStopped(at)
        // Debounced commit — brief Arabic pauses must not finalize mid-sentence.
        utteranceAssembler.scheduleCommit(ARABIC_UTTERANCE_COMMIT_MS)
      }
      // Stay listening — do NOT enter thinking or create a response on VAD alone.
      if (status === 'listening' && !hasCancellableResponse()) {
        setStatus('listening')
      }
      telemetry('speech_stopped_no_auto_response', {
        status,
        assembling: utteranceAssembler.hasPending(),
        capture: captureAudit.snapshot(),
      })
      return
    }

    if (type === 'input_audio_buffer.committed') {
      // Server accepted the input audio buffer for this turn.
      captureAudit.onServerAudioCommitted()
      telemetry('input_audio_buffer_committed', captureAudit.snapshot())
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      if (status !== 'listening') {
        logAsrDiagnostics('asr_delta_ignored_not_listening', {
          status,
          sample: event.delta.slice(0, 40),
        })
        return
      }
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
      if (status !== 'listening') {
        logAsrDiagnostics('asr_segment_ignored_not_listening', {
          status,
          sample: event.transcript.slice(0, 40),
        })
        return
      }
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
        const segmentLang = gated.lockedLanguage
        transcriptGate.resetTurn()
        // Preserve FR/EN ASR language — forcing `ar` here rejected Latin finals next segment.
        if (segmentLang === 'fr' || segmentLang === 'en' || segmentLang === 'ar') {
          activeLanguage = segmentLang
          preferredInputLanguage = segmentLang
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
      playbackDiag.assistantResponseCreated = true
      playbackDiag.lastEvent = 'assistantResponseCreated'
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
      enterSpeakingIfAudible('output_buffer')
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
      if (status !== 'speaking') enterSpeakingIfAudible('audio_delta')
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
        // Transcript may precede audio — keep status thinking until remote audio plays.
        // Never claim speaking from text-only deltas (Safari silent-speaking root cause).
        telemetry('response_transcript_delta', { responseId: activeResponse.id })
      }
      assistantBuffer += event.delta
      callbacks.onAssistantTranscript?.(assistantBuffer, false)
      if (status !== 'speaking' && status !== 'thinking') setStatus('thinking')
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
        // CRITICAL: never treat transcript text as hadAudio. That masked silent
        // remote tracks and blocked classic TTS recovery (text visible, no speaker).
        if (activeResponse.hadAudio) {
          activeResponse.audioStreamDone = true
          if (!activeResponse.playbackStopped) schedulePlaybackFallback()
        } else if (!activeResponse.cancelled) {
          activeResponse.playbackStopped = true
          telemetry('response_done_no_audio', {
            responseId: activeResponse.id,
            status,
            sample: lastAssistantSpoken.slice(0, 40),
          })
          // Surface as playback failure so BilamoVoiceSession runs ONE classic TTS.
          callbacks.onError?.(
            'تعذر تشغيل الصوت — لا يوجد بث صوتي من الجلسة المباشرة',
          )
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
    async connect(options?: RealtimeConnectOptions) {
      if (disposed) return
      // Explicit user start — clear hard Stop latch; keep preferred FR/EN/AR ASR language.
      hardStopped = false
      sessionGeneration += 1
      activeLanguage = preferredInputLanguage || activeLanguage || 'ar'
      lockedUserTranscript = null
      utteranceAssembler.reset()
      transcriptGate.resetTurn()
      clearPlaybackTimers()
      noteVoiceLifecycleStage('GESTURE_RECEIVED')
      // Allow reconnect after a clean disconnect on the same session object.
      // Prefer keeping the live peer — rebuilding mid-session drops mic frames.
      if (pc && dc && dc.readyState === 'open') {
        if (options?.localStream && !hasLiveMicTrack()) {
          localStream = options.localStream
          captureAudit.attachLocalStream(localStream)
          noteVoiceLifecycleStage('MEDIASTREAM_ACTIVE')
        }
        const ok = hasLiveMicTrack() || (await acquireLocalMic())
        if (!ok) {
          noteVoiceLifecycleStage('MIC_PERMISSION_FAILED', { code: 'MIC_REACQUIRE_FAILED' })
          callbacks.onError?.(VOICE_RECOVERABLE_ERROR_AR)
          setStatus('error')
          return
        }
        reassertTurnDetection()
        setStatus('listening')
        return
      }
      if (pc) {
        // Full peer rebuild — count as a Realtime reconnect for capture audit.
        captureAudit.markReconnect(
          `stale_peer:${pc.connectionState}:${dc?.readyState ?? 'no_dc'}`,
        )
        tearDownPeer()
      }
      setStatus('connecting')
      noteVoiceLifecycleStage('CONNECTION_STATE_CONNECTING')

      const prefs = loadVoiceExperiencePrefs()
      const voice = mapPrefsToRealtimeVoice(prefs)

      // Mic BEFORE peer/network — Safari loses gesture if getUserMedia runs after awaits.
      if (options?.localStream) {
        localStream = options.localStream
        noteVoiceLifecycleStage('MIC_PERMISSION_GRANTED')
      } else {
        noteVoiceLifecycleStage('MIC_PERMISSION_REQUESTED')
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
          })
          noteVoiceLifecycleStage('MIC_PERMISSION_GRANTED')
        } catch (err) {
          noteVoiceLifecycleStage('MIC_PERMISSION_FAILED', { code: 'MIC_PERMISSION_FAILED' })
          playbackDiag.lastSafeErrorCode = 'MIC_PERMISSION_FAILED'
          callbacks.onError?.(VOICE_RECOVERABLE_ERROR_AR)
          setStatus('error')
          throw err instanceof Error ? err : new Error('mic_permission_failed')
        }
      }
      if (!localStream?.getAudioTracks?.().some((t) => t.readyState === 'live')) {
        noteVoiceLifecycleStage('MIC_PERMISSION_FAILED', { code: 'MIC_TRACK_MISSING' })
        setStatus('error')
        throw new Error('mic_track_missing')
      }
      captureAudit.attachLocalStream(localStream)
      noteVoiceLifecycleStage('MEDIASTREAM_ACTIVE')
      playbackDiag.mediaStreamActive = true

      // Best-effort unlock AFTER mic — never delay getUserMedia for AudioContext.
      try {
        await unlockAudioPlayback()
      } catch {
        /* best-effort */
      }

      // Register ontrack BEFORE negotiation — required so early audio is not dropped.
      pc = new RTCPeerConnection()
      noteVoiceLifecycleStage('PEER_CREATED')
      playbackDiag.peerConnectionState = pc.connectionState
      captureAudit.attachPeer(pc)
      // Transport hardening: tolerate brief ICE blips; fail soft on hard drops mid-utterance.
      const peer = pc
      peer.oniceconnectionstatechange = () => {
        const ice = peer.iceConnectionState
        playbackDiag.iceConnectionState = ice
        captureAudit.noteIceConnectionState(ice)
        if (ice === 'checking') noteVoiceLifecycleStage('ICE_STATE_CHECKING')
        else if (ice === 'connected' || ice === 'completed') noteVoiceLifecycleStage('ICE_STATE_CONNECTED')
        else if (ice === 'failed') noteVoiceLifecycleStage('ICE_STATE_FAILED')
        else if (ice === 'disconnected') noteVoiceLifecycleStage('ICE_STATE_DISCONNECTED')
        if (ice === 'disconnected') {
          if (iceRecoveryTimer) clearTimeout(iceRecoveryTimer)
          // Mobile Safari often blips ICE briefly — wait before treating as loss.
          iceRecoveryTimer = setTimeout(() => {
            iceRecoveryTimer = null
            if (hardStopped || disposed || peer !== pc) return
            if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
              if (utteranceAssembler.hasPending()) {
                rejectTurnForTransport(`ice_${peer.iceConnectionState}`)
              }
            }
          }, 2500)
          return
        }
        if (ice === 'connected' || ice === 'completed') {
          if (iceRecoveryTimer) {
            clearTimeout(iceRecoveryTimer)
            iceRecoveryTimer = null
          }
          ensureLocalMicLive()
          return
        }
        if (ice === 'failed' && utteranceAssembler.hasPending()) {
          rejectTurnForTransport('ice_failed')
        }
      }
      peer.onconnectionstatechange = () => {
        playbackDiag.peerConnectionState = peer.connectionState
        captureAudit.noteConnectionState(peer.connectionState)
        if (peer.connectionState === 'connected') {
          noteVoiceLifecycleStage('CONNECTION_STATE_CONNECTED')
        } else if (peer.connectionState === 'failed') {
          noteVoiceLifecycleStage('CONNECTION_STATE_FAILED')
        }
        if (peer.connectionState === 'failed' && utteranceAssembler.hasPending()) {
          rejectTurnForTransport('connection_failed')
        }
      }

      // Reuse the gesture-primed remote element — never invent a new locked <audio>.
      remoteAudio = obtainPrimedRemoteAudioElement()
      remoteAudio.autoplay = true
      remoteAudio.setAttribute('playsinline', 'true')
      remoteAudio.setAttribute('webkit-playsinline', 'true')
      remoteAudio.muted = false
      remoteAudio.volume = 1
      playbackDiag.audioElementAttached = true
      noteVoiceLifecycleStage('AUDIO_ELEMENT_ATTACHED')

      pc.ontrack = (e) => {
        if (!remoteAudio) return
        const stream = e.streams[0] ?? null
        // Reuse the single persistent audio element — never create duplicates.
        remoteAudio.srcObject = stream
        remoteTrack = stream?.getAudioTracks()?.[0] ?? e.track ?? null
        playbackDiag.remoteTrackReceived = Boolean(remoteTrack)
        playbackDiag.audioElementAttached = Boolean(remoteAudio.srcObject)
        playbackDiag.lastEvent = 'REMOTE_TRACK_RECEIVED'
        noteVoiceLifecycleStage('REMOTE_TRACK_RECEIVED')
        if (remoteTrack) {
          remoteTrack.enabled = true
          playbackDiag.remoteTrackMuted = remoteTrack.muted
          playbackDiag.remoteTrackReadyState = remoteTrack.readyState
          remoteTrack.onmute = () => {
            playbackDiag.remoteTrackMuted = true
            playbackDiag.remoteTrackReadyState = remoteTrack?.readyState ?? null
            playbackDiag.lastEvent = 'remoteTrackMuted'
          }
          remoteTrack.onunmute = () => {
            playbackDiag.remoteTrackMuted = false
            playbackDiag.remoteTrackReadyState = remoteTrack?.readyState ?? null
            playbackDiag.lastEvent = 'remoteTrackUnmuted'
            if (remoteTrack) remoteTrack.enabled = true
            void ensureRemoteAudible()
          }
          remoteTrack.onended = () => {
            playbackDiag.lastEvent = 'remoteTrackEnded'
            playbackDiag.remoteTrackReadyState = remoteTrack?.readyState ?? 'ended'
            if (!hardStopped && !disposed && (status === 'speaking' || status === 'thinking')) {
              releaseToIdleInternal('remote_track_ended')
            }
          }
        }
        remoteAudio.autoplay = true
        remoteAudio.setAttribute('playsinline', 'true')
        remoteAudio.setAttribute('webkit-playsinline', 'true')
        remoteAudio.muted = false
        remoteAudio.volume = 1
        // Attach only — do not claim SPEAKING until assistant audio actually plays.
        noteVoiceLifecycleStage('PLAY_CALLED')
        void remoteAudio.play().catch(() => {
          /* gesture may be required; ensureRemoteAudible retries on response audio */
        })
        setStatus('listening')
      }

      for (const track of localStream.getTracks()) {
        try {
          if ('contentHint' in track) {
            ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
          }
        } catch {
          // ignore
        }
        pc.addTrack(track, localStream)
        noteVoiceLifecycleStage('LOCAL_TRACK_ADDED')
      }
      // Prefer continuous mic send — never start muted.
      ensureLocalMicLive()

      dc = pc.createDataChannel('oai-events')
      dc.onmessage = (ev) => {
        if (typeof ev.data === 'string') handleServerEvent(ev.data)
      }
      dc.onclose = () => {
        logPipeline({
          stage: 'microphone',
          event: 'capture_datachannel_closed',
          meta: {
            assembling: utteranceAssembler.hasPending(),
            connectionState: pc?.connectionState ?? null,
          },
        })
        if (utteranceAssembler.hasPending()) {
          rejectTurnForTransport('datachannel_closed')
        }
      }
      dc.onerror = () => {
        logPipeline({
          stage: 'microphone',
          event: 'capture_datachannel_error',
          meta: { assembling: utteranceAssembler.hasPending() },
        })
      }
      dc.onopen = () => {
        const built = buildInstructions(undefined, activeLanguage)
        activeLanguage = built.language
        // Enable input transcription with language hint + ChatGPT-Voice-like turn detection.
        // Lock output_modalities to audio so speakWrittenDraft cannot go text-only.
        sendEvent({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: built.instructions,
            output_modalities: ['audio'],
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
          sampleRate: captureAudit.snapshot().sampleRate ?? null,
          channelCount: captureAudit.snapshot().channelCount ?? null,
        })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      noteVoiceLifecycleStage('OFFER_CREATED')

      const initial = buildInstructions(undefined, activeLanguage)
      activeLanguage = initial.language
      const { voiceAuthenticatedFetch } = await import('../../security/voiceAuthProbe')
      const res = await voiceAuthenticatedFetch('/api/openai/realtime-call', {
        method: 'POST',
        kind: 'realtime',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          voice,
          instructions: initial.instructions,
          dialectHint: dialectChatGuidance(prefs.dialect),
        }),
      })

      if (!res.ok) {
        logChat('error', 'voice', 'realtime_call_failed', {
          status: res.status,
        })
        playbackDiag.httpRoute = '/api/openai/realtime-call'
        playbackDiag.httpStatus = res.status
        playbackDiag.safeServerErrorCode =
          res.status === 401 ? 'AUTH_INVALID' : res.status === 403 ? 'CORS_ORIGIN_DENIED' : `HTTP_${res.status}`
        playbackDiag.lastSafeErrorCode = playbackDiag.safeServerErrorCode
        noteVoiceLifecycleStage('REALTIME_AUDIO_FAILED', { code: playbackDiag.safeServerErrorCode })
        callbacks.onError?.(VOICE_RECOVERABLE_ERROR_AR)
        setStatus('error')
        tearDownPeer()
        throw new Error(`realtime_call_failed:${res.status}`)
      }
      playbackDiag.realtimeSessionCreated = true
      playbackDiag.httpRoute = '/api/openai/realtime-call'
      playbackDiag.httpStatus = res.status
      noteVoiceLifecycleStage('SESSION_HTTP_OK')
      noteVoiceLifecycleStage('VOICE_REQUEST_ACCEPTED')

      const answerSdp = await res.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      noteVoiceLifecycleStage('REMOTE_DESCRIPTION_SET')
      // Must not stall in connecting/idle — listening or explicit failure.
      if (status !== 'listening' && status !== 'error') {
        setStatus('listening')
      }
    },
    disconnect() {
      // Soft teardown: tear down peer without latching hardStopped.
      // Latch was a root cause of silent speakWrittenDraft (speak_blocked_hard_stopped)
      // after a soft disconnect when the same session object later spoke.
      if (disposed) return
      sessionGeneration += 1
      clearPlaybackTimers()
      clientRequestedResponse = false
      speakQueue = []
      utteranceAssembler.cancelPendingCommit()
      utteranceAssembler.reset()
      lockedUserTranscript = null
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
      logMicSessionState('IDLE', { source: 'realtime', reason: 'disconnect_soft' })
      telemetry('disconnect_soft', { hardStopped })
      callbacks.onStatus?.('idle')
      callbacks.onDisconnected?.()
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
    async ensureListening() {
      const sessionBusy = () =>
        status === 'speaking'
        || status === 'thinking'
        || hasCancellableResponse()
        || speakQueue.length > 0
      if (disposed || hardStopped) {
        telemetry('ensure_listening_blocked', { disposed, hardStopped })
        return false
      }
      if (!pc || !dc || dc.readyState !== 'open') return false
      // Never Listening while Processing/Speaking — mic stays released.
      if (sessionBusy()) {
        telemetry('ensure_listening_blocked_busy', { status, queue: speakQueue.length })
        return false
      }
      const ok = await acquireLocalMic()
      if (!ok || hardStopped || disposed) return false
      // Re-read after await (status may change during mic acquire on Safari).
      if (sessionBusy()) {
        stopLocalMicCapture('ensure_listening_aborted_busy')
        return false
      }
      reassertTurnDetection()
      muteRemote(false)
      setStatus('listening')
      return true
    },
    getPlaybackDiagnostics() {
      playbackDiag.peerConnectionState = pc?.connectionState ?? null
      playbackDiag.iceConnectionState = pc?.iceConnectionState ?? null
      return { ...playbackDiag }
    },
    releaseToIdle(reason = 'release_to_idle') {
      if (disposed) return
      // Do not latch hardStopped — user may tap mic again without a full reconnect.
      releaseToIdleInternal(reason)
    },
    finalizeListening() {
      if (disposed || hardStopped) return
      playbackDiag.endOfSpeechDetected = true
      playbackDiag.lastEvent = 'finalizeListening'
      telemetry('finalize_listening', {
        pending: utteranceAssembler.hasPending(),
        committed: utteranceAssembler.isCommitted(),
      })
      // Prefer commit over cancel — silence / orb-stop must submit, not drop ASR.
      if (utteranceAssembler.hasPending() && !utteranceAssembler.isCommitted()) {
        playbackDiag.inputCommitted = true
        utteranceAssembler.forceCommitNow()
        return
      }
      if (utteranceAssembler.isCommitted() || lockedUserTranscript != null) {
        playbackDiag.inputCommitted = true
        return
      }
      // Nothing to commit — release mic without latching hard stop.
      releaseToIdleInternal('finalize_empty')
    },
    isHardStopped() {
      return hardStopped
    },
    interrupt() {
      if (hardStopped || disposed) return
      // Cancel playback only — never auto-reopen Listening (explicit mic tap required).
      speakQueue = []
      interruptInternal(true, { rearmMic: false })
      releaseToIdleInternal('interrupt')
    },
    sendText(text: string) {
      // Architecture: text turns are owned by planTurn (Bilamo VoiceSession / chatEngine).
      // Realtime must not create a parallel spoken reply from sendText.
      const cleaned = text.trim()
      if (!cleaned) return
      telemetry('send_text_ignored_turn_owner_is_plan_turn', { sample: cleaned.slice(0, 40) })
      // Text turns must not reopen the mic.
      if (!hardStopped && status === 'listening') {
        releaseToIdleInternal('send_text')
      }
    },
    setInputLanguage(language) {
      if (disposed) return
      if (!language) return
      applyInputLanguage(language, 'set_input_language')
    },
    speakWrittenDraft(written, opts) {
      if (hardStopped || disposed) {
        telemetry('speak_blocked_hard_stopped')
        return
      }
      const locale: LockedSpeechLanguage = opts?.locale || activeLanguage || 'ar'
      // Sole Realtime speech path — speak the same text the UI shows.
      // Strip advice/website chrome only; do not invent a shorter second reply.
      const cleaned = toSpokenDialogue(written, {
        locale: locale === 'ar' ? 'ar' : 'en',
        maxChars: Math.max(280, written.trim().length),
        context: inferSpokenContext(written),
      })
      const spoken = (cleaned || written).replace(/\s+/g, ' ').trim()
      if (!spoken) return
      // If audio is already playing, queue the next breath-group (progressive TTS).
      if (hasCancellableResponse()) {
        speakQueue.push({ spoken, locale })
        telemetry('speak_queued', { queue: speakQueue.length, sample: spoken.slice(0, 40) })
        return
      }
      startSpeakUtterance(spoken, locale)
    },
  }
}
