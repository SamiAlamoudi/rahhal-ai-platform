/**
 * OpenAI Realtime WebRTC session (speech-to-speech).
 * Uses the unified interface: browser SDP → /api/openai/realtime-call → SDP answer.
 *
 * One remote audio stream (no classic TTS clips) → no duplicate/stitched playback.
 * Barge-in: response.cancel + output_audio_buffer.clear + mute remote track immediately.
 * Never replays cancelled speech.
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
    fallbackPreference: prefs.languageFallback,
  })
  return {
    language: resolved.language,
    instructions: buildConsultantConversationalInstructions({
      dialect: prefs.dialect,
      utterance: moodText,
      language: prefs.language,
      previousLanguage,
      languageFallback: prefs.languageFallback,
      locale: resolved.language === 'ar' ? 'ar' : 'en',
      mood,
      dialogueContext: moodText ? inferSpokenContext(moodText) : undefined,
      speed: prefs.speed,
      energy: prefs.energy,
    }),
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
  let interruptedPartial = ''
  /** Active spoken language for this Realtime call (language layer only). */
  let activeLanguage: Exclude<ConversationLanguageCode, 'auto'> | null = null
  const quality = createRealtimeQualityTracker()

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
          },
          output: { voice },
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
  }

  const interruptInternal = (fromBargeIn = false) => {
    const partial = assistantBuffer.trim()
    const wasSpeaking = status === 'speaking'
    sendEvent({ type: 'response.cancel' })
    sendEvent({ type: 'output_audio_buffer.clear' })
    muteRemote(true)
    // Brief mute then re-arm listening — never replay cancelled buffer.
    queueMicrotask(() => {
      muteRemote(false)
      ensureLocalMicLive()
    })
    if (fromBargeIn) {
      quality.markSpeechStarted(wasSpeaking)
    } else {
      quality.markManualInterrupt()
    }
    emitQuality()
    if (fromBargeIn && partial) {
      interruptedPartial = partial
      callbacks.onInterrupted?.(partial)
      // Keep partial on screen — do not restart / clear the whole reply text.
      callbacks.onAssistantTranscript?.(partial, true)
    }
    assistantBuffer = ''
  }

  const handleServerEvent = (raw: string) => {
    let event: { type?: string; transcript?: string; delta?: string; error?: { message?: string } }
    try {
      event = JSON.parse(raw) as typeof event
    } catch {
      return
    }
    const type = event.type || ''

    if (type === 'error' || type === 'response.failed') {
      const message = event.error?.message || 'Realtime session error'
      logChat('error', 'voice', 'realtime_server_error', { type, message })
      callbacks.onError?.(message)
      setStatus('error')
      return
    }

    if (type === 'input_audio_buffer.speech_started') {
      // Barge-in: stop audio immediately; do not restart the cancelled reply.
      interruptInternal(true)
      setStatus('listening')
      return
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      quality.markSpeechStopped()
      emitQuality()
      setStatus('thinking')
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      callbacks.onUserTranscript?.(event.delta, false)
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      callbacks.onUserTranscript?.(event.transcript, true)
      // Language layer only: refresh multilingual + dialect cues; preserve trip facts in memory.
      const built = buildInstructions(event.transcript, activeLanguage)
      activeLanguage = built.language
      sendEvent({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: built.instructions,
        },
      })
      return
    }

    if (
      (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta')
      && typeof event.delta === 'string'
    ) {
      if (!assistantBuffer) quality.markFirstAssistantAudio()
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
      // On iPhone, transcript can finish before remote audio ends; early "listening"
      // made the mic button look idle and a tap tore the session down.
      if (assistantBuffer) callbacks.onAssistantTranscript?.(assistantBuffer, true)
      return
    }

    if (type === 'response.done') {
      if (assistantBuffer) callbacks.onAssistantTranscript?.(assistantBuffer, true)
      assistantBuffer = ''
      interruptedPartial = ''
      quality.markResponseDone()
      emitQuality()
      logChat('debug', 'voice', 'realtime_quality', quality.snapshot() as unknown as Record<string, unknown>)
      ensureLocalMicLive()
      reassertTurnDetection()
      setStatus('listening')
      return
    }

    if (type === 'response.created') {
      assistantBuffer = ''
      quality.markResponseCreated()
      emitQuality()
      setStatus('thinking')
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
        // Enable input transcription + ChatGPT-Voice-like turn detection.
        sendEvent({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: built.instructions,
            audio: {
              input: {
                transcription: { model: 'gpt-4o-mini-transcribe' },
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
        callbacks.onError?.(`تعذر بدء الصوت المباشر (${res.status})`)
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
      interruptInternal()
      tearDownPeer()
      setStatus('idle')
      callbacks.onDisconnected?.()
    },
    dispose() {
      disposed = true
      interruptInternal()
      tearDownPeer()
      setStatus('idle')
      callbacks.onDisconnected?.()
    },
    ensureListening() {
      if (disposed) return
      if (!pc || !dc || dc.readyState !== 'open') return
      ensureLocalMicLive()
      reassertTurnDetection()
      muteRemote(false)
      if (status !== 'listening') setStatus('listening')
    },
    interrupt() {
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
      sendEvent({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: built.instructions,
          audio: {
            input: {
              turn_detection: buildRealtimeTurnDetection(),
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
      sendEvent({ type: 'response.create' })
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
      sendEvent({ type: 'response.create' })
      callbacks.onAssistantTranscript?.(spoken, false)
    },
  }
}
