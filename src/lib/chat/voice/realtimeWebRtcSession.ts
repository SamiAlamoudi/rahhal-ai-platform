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

export type RealtimeSessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'

export type RealtimeWebRtcCallbacks = {
  onStatus?: (status: RealtimeSessionStatus) => void
  onUserTranscript?: (text: string, isFinal: boolean) => void
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
  /** Permanent teardown (component unmount). Further connect() calls are no-ops. */
  dispose: () => void
  interrupt: () => void
  /**
   * Re-arm mic + turn detection after an assistant turn without recreating WebRTC.
   * Safe no-op when not connected.
   */
  ensureListening: () => void
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
  audioStarted: boolean
  audioDone: boolean
  responseDone: boolean
  cancelled: boolean
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
  const hint = transcriptionLanguageHint(language)
  return hint
    ? { model: 'gpt-4o-mini-transcribe' as const, language: hint }
    : { model: 'gpt-4o-mini-transcribe' as const }
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
  let interruptedPartial = ''
  /** Active spoken language for this Realtime call (language layer only). */
  let activeLanguage: LockedSpeechLanguage | null = null
  /** Language frozen for the current assistant response. */
  let assistantTurnLanguage: LockedSpeechLanguage | null = null
  let activeResponse: ActiveResponseState | null = null
  /** Echo protection: ignore VAD barge-in until assistant has been speaking this long. */
  let assistantAudioStartedAt = 0
  /** Last finalized assistant spoken text — used to reject self-echo transcripts. */
  let lastAssistantSpoken = ''
  /** When the last assistant turn fully completed (for post-response silence guard). */
  let responseDoneAt = 0
  /**
   * Client-authorized response.create only.
   * If response.created arrives without this flag, cancel it (unsolicited auto-turn).
   */
  let clientRequestedResponse = false
  const quality = createRealtimeQualityTracker()

  const transcriptGate = createUserTranscriptGate(() => activeLanguage)

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

  const setStatus = (next: RealtimeSessionStatus) => {
    status = next
    callbacks.onStatus?.(next)
  }

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
      ...detail,
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
    assistantAudioStartedAt = 0
  }

  const hasCancellableResponse = (): boolean => {
    if (!activeResponse) return false
    if (activeResponse.cancelled) return false
    if (activeResponse.responseDone && activeResponse.audioDone) return false
    return true
  }

  /**
   * Exactly one assistant response per confirmed user input.
   * Never call this on speech_stopped / silence / noise.
   */
  const requestAssistantResponse = (reason: string) => {
    if (disposed) return
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
    // If assistant turn language is locked, keep speaking that language.
    if (assistantTurnLanguage && built.language !== assistantTurnLanguage) {
      // Explicit switch only applies after the current assistant turn finishes.
      activeLanguage = built.language
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
    interruptedPartial = ''
    activeLanguage = null
    clearActiveResponse()
    transcriptGate.resetTurn()
    lastAssistantSpoken = ''
    responseDoneAt = 0
    clientRequestedResponse = false
  }

  /**
   * Cancel only when a response is actively generating or speaking.
   * Root cause of "Cancellation failed: no active response found":
   * every speech_started / disconnect previously sent response.cancel blindly.
   */
  const interruptInternal = (fromBargeIn = false) => {
    const partial = assistantBuffer.trim()
    const wasSpeaking = status === 'speaking' || Boolean(activeResponse)
    const canCancel = hasCancellableResponse()

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
      queueMicrotask(() => {
        muteRemote(false)
        ensureLocalMicLive()
      })
    } else {
      // Skip network cancel entirely — harmless local no-op.
      telemetry('response_cancel_skipped_no_active', { fromBargeIn })
      ensureLocalMicLive()
    }

    if (fromBargeIn) {
      quality.markSpeechStarted(wasSpeaking)
    } else {
      quality.markManualInterrupt()
    }
    emitQuality()

    if (fromBargeIn && partial && canCancel) {
      interruptedPartial = partial
      callbacks.onInterrupted?.(partial)
      callbacks.onAssistantTranscript?.(partial, true)
    }
    if (canCancel) {
      assistantBuffer = ''
      clearActiveResponse()
    }
  }

  const maybeEnterListening = () => {
    // Do not switch to listening until the assistant audio has genuinely completed.
    if (activeResponse && !activeResponse.cancelled) {
      if (!activeResponse.responseDone) return
      // If audio started, wait for audio.done; if text-only, response.done is enough.
      if (activeResponse.audioStarted && !activeResponse.audioDone) return
    }
    if (assistantBuffer.trim()) {
      lastAssistantSpoken = assistantBuffer.trim()
    }
    responseDoneAt = nowMs()
    clientRequestedResponse = false
    clearActiveResponse()
    ensureLocalMicLive()
    reassertTurnDetection()
    // Idle listening — stay silent until a confirmed user utterance.
    setStatus('listening')
    telemetry('entered_idle_listening', { responseDoneAt })
  }

  const handleServerEvent = (raw: string) => {
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
      transcriptGate.resetTurn()
      // Root cause of early audio cut on iPhone: speaker echo → VAD speech_started
      // → response.cancel mid-reply while transcript deltas already painted.
      // Only barge-in when a response is active AND assistant has been audibly
      // speaking long enough that echo alone is unlikely (or user is clearly overlapping).
      const ECHO_GUARD_MS = 1800
      const speakingLongEnough =
        assistantAudioStartedAt > 0
        && (typeof performance !== 'undefined' ? performance.now() : Date.now()) - assistantAudioStartedAt >= ECHO_GUARD_MS

      if (hasCancellableResponse() && (status === 'speaking' || status === 'thinking') && speakingLongEnough) {
        interruptInternal(true)
        setStatus('listening')
      } else {
        // Idle / early echo / no active response → never send response.cancel.
        quality.markSpeechStarted(status === 'speaking')
        emitQuality()
        telemetry('speech_started_no_cancel', {
          hadActive: Boolean(activeResponse),
          speakingLongEnough,
          status,
        })
        if (status === 'listening' || status === 'thinking') {
          // User started a new utterance — stay listening/thinking; no cancel.
        }
      }
      return
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      quality.markSpeechStopped()
      emitQuality()
      // Stay listening — do NOT enter thinking or create a response on VAD alone.
      // Silence / breathing / noise stop events must leave the assistant idle.
      if (!hasCancellableResponse() && status !== 'speaking') {
        setStatus('listening')
      }
      telemetry('speech_stopped_no_auto_response', { status })
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      const gated = transcriptGate.ingestDelta(event.delta)
      if (gated.displayText != null) {
        callbacks.onUserTranscript?.(gated.displayText, false)
      }
      // suppressed → UI keeps prior stable text / listening indicator (no foreign flash)
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      const gated = transcriptGate.ingestFinal(event.transcript)
      if (gated.accepted && gated.displayText && shouldAcceptTranscriptForResponse(gated.displayText)) {
        callbacks.onUserTranscript?.(gated.displayText, true)
        if (gated.lockedLanguage) {
          activeLanguage = gated.lockedLanguage
        }
        // Refresh language for NEXT assistant turn only when idle.
        refreshLanguageInstructionsIfIdle(gated.displayText)
        // One confirmed user utterance → exactly one assistant response.
        requestAssistantResponse('confirmed_asr')
      } else {
        telemetry('final_transcript_no_response', {
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
      // Defense: cancel unsolicited auto-turns (should not happen with create_response:false,
      // but guards against server-side / race regressions).
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
      activeResponse = {
        id,
        createdAt: nowMs(),
        audioStarted: false,
        audioDone: false,
        responseDone: false,
        cancelled: false,
        language: lang,
      }
      assistantBuffer = ''
      quality.markResponseCreated()
      emitQuality()
      telemetry('response_created', { responseId: id, language: lang })
      setStatus('thinking')
      return
    }

    if (
      type === 'response.output_audio.delta'
      || type === 'response.audio.delta'
    ) {
      if (activeResponse && !activeResponse.audioStarted) {
        activeResponse.audioStarted = true
        assistantAudioStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
        quality.markFirstAssistantAudio()
        emitQuality()
        telemetry('response_audio_started', { responseId: activeResponse.id })
      }
      setStatus('speaking')
      muteRemote(false)
      return
    }

    if (
      type === 'response.output_audio.done'
      || type === 'response.audio.done'
    ) {
      if (activeResponse) {
        activeResponse.audioDone = true
        telemetry('response_audio_done', { responseId: activeResponse.id })
      }
      maybeEnterListening()
      return
    }

    if (
      (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta')
      && typeof event.delta === 'string'
    ) {
      if (!assistantBuffer) {
        quality.markFirstAssistantAudio()
        if (activeResponse && !activeResponse.audioStarted) {
          // Transcript often starts with/before audio on some builds — mark speaking.
          activeResponse.audioStarted = true
          assistantAudioStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
          telemetry('response_audio_started', { responseId: activeResponse.id, via: 'transcript' })
        }
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
      // Finalize transcript text only — do NOT flip to listening yet.
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
      interruptedPartial = ''
      if (activeResponse) {
        activeResponse.responseDone = true
        // Text-only / no audio deltas: treat audio as done so we can listen.
        if (!activeResponse.audioStarted) activeResponse.audioDone = true
      }
      quality.markResponseDone()
      emitQuality()
      telemetry('response_done', {
        responseId: activeResponse?.id,
        audioDone: activeResponse?.audioDone ?? true,
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
      // Soft end: release peer/mic so connect() can start a new call later.
      // Do NOT set disposed — that permanently kills the session object (iPhone bug).
      interruptInternal(false)
      tearDownPeer()
      setStatus('idle')
      callbacks.onDisconnected?.()
    },
    dispose() {
      disposed = true
      interruptInternal(false)
      tearDownPeer()
      setStatus('idle')
      callbacks.onDisconnected?.()
    },
    ensureListening() {
      if (disposed) return
      if (!pc || !dc || dc.readyState !== 'open') return
      // Never force listening while an assistant response is still speaking.
      if (hasCancellableResponse() && status === 'speaking') return
      ensureLocalMicLive()
      reassertTurnDetection()
      muteRemote(false)
      if (status !== 'listening') setStatus('listening')
    },
    interrupt() {
      // Explicit user barge-in (mic tap) — always allowed when a response is active.
      interruptInternal(true)
      ensureLocalMicLive()
      setStatus('listening')
    },
    sendText(text: string) {
      const cleaned = text.trim()
      if (!cleaned) return
      assistantBuffer = ''
      setStatus('thinking')
      const prefs = loadVoiceExperiencePrefs()
      const built = buildInstructions(cleaned, activeLanguage)
      activeLanguage = built.language
      // Refresh conversational + language cues for this utterance — engine unchanged.
      // Only when no active response (sendText starts a new turn).
      sendEvent({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: built.instructions,
          audio: {
            input: {
              turn_detection: buildRealtimeTurnDetection(),
              transcription: transcriptionConfig(activeLanguage),
            },
            output: { voice: mapPrefsToRealtimeVoice(prefs) },
          },
        },
      })
      // If we were interrupted mid-reply, remind the model not to restart it.
      if (interruptedPartial) {
        sendEvent({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [{
              type: 'input_text',
              text: 'Previous assistant reply was interrupted. Do not restart or repeat it. Respond only to the traveler\'s new message with a short spoken reply.',
            }],
          },
        })
        interruptedPartial = ''
      }
      quality.markSpeechStopped()
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: cleaned }],
        },
      })
      requestAssistantResponse('send_text')
    },
    speakWrittenDraft(written, opts) {
      const locale = opts?.locale === 'en' ? 'en' : 'ar'
      const spoken = toSpokenDialogue(written, {
        locale,
        maxChars: 220,
        context: inferSpokenContext(written),
      })
      if (!spoken) return
      const context = inferSpokenContext(spoken)
      assistantBuffer = ''
      setStatus('thinking')
      // Post-processed dialogue is fed as a speak-this instruction — engine unchanged.
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: [
              'Speak the following consultant dialogue aloud now, verbatim, as a live call.',
              spokenToneCue(context),
              'Vary prosody naturally. Do not expand into an article. Do not add process narration.',
              'Do not add extra questions beyond what is written.',
              `DIALOGUE: ${spoken}`,
            ].join('\n'),
          }],
        },
      })
      requestAssistantResponse('speak_written_draft')
      callbacks.onAssistantTranscript?.(spoken, false)
    },
  }
}
