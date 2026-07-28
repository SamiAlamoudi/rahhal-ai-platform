/**
 * OpenAI Realtime WebRTC session (speech-to-speech).
 * Uses the unified interface: browser SDP → /api/openai/realtime-call → SDP answer.
 *
 * One remote audio stream (no classic TTS clips) → no duplicate/stitched playback.
 * Barge-in: response.cancel + truncate + mute remote track immediately.
 */

import { logChat } from '../chatLogger'
import { dialectChatGuidance, loadVoiceExperiencePrefs } from './voiceExperiencePrefs'
import { REALTIME_PUBLIC_MODEL } from './voiceArchitecture'

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
  onError?: (message: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export type RealtimeWebRtcSession = {
  connect: () => Promise<void>
  disconnect: () => void
  interrupt: () => void
  /** Send a text user turn into the live session (no classic TTS). */
  sendText: (text: string) => void
  getStatus: () => RealtimeSessionStatus
  isConnected: () => boolean
}

function buildInstructions(): string {
  const prefs = loadVoiceExperiencePrefs()
  return [
    'You are Rahhal (رحّال), an experienced Arabic travel consultant on a live voice call.',
    'Speak naturally like a human consultant — warm, calm, concise, confident, never pushy.',
    'Prefer short spoken replies (1–2 sentences) unless presenting a confirmed plan.',
    'GROUNDING: Use ONLY facts the traveler stated in this call.',
    'NEVER invent traveler count, budget, destination, dates, duration, origin, or trip purpose.',
    'Greeting-only with empty facts → brief greeting + ONE neutral destination question.',
    'Example: وعليكم السلام، حياك الله. وين حاب تسافر؟',
    'Ask at most ONE follow-up question per turn.',
    'Do not mention OpenAI, ChatGPT, models, or being an AI unless asked.',
    'Absolutely no English words when speaking Arabic.',
    dialectChatGuidance(prefs.dialect),
    'If a strong regional accent would sound unnatural, use clear natural Arabic instead of a poor imitation.',
  ].join(' ')
}

export function createRealtimeWebRtcSession(
  callbacks: RealtimeWebRtcCallbacks = {},
): RealtimeWebRtcSession {
  let status: RealtimeSessionStatus = 'idle'
  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let localStream: MediaStream | null = null
  let remoteAudio: HTMLAudioElement | null = null
  let assistantBuffer = ''
  let disposed = false

  const setStatus = (next: RealtimeSessionStatus) => {
    status = next
    callbacks.onStatus?.(next)
  }

  const sendEvent = (event: Record<string, unknown>) => {
    if (!dc || dc.readyState !== 'open') return
    dc.send(JSON.stringify(event))
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
      // Barge-in: user started speaking while model may be talking.
      interruptInternal()
      setStatus('listening')
      return
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      setStatus('thinking')
      return
    }

    if (type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      callbacks.onUserTranscript?.(event.delta, false)
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      callbacks.onUserTranscript?.(event.transcript, true)
      return
    }

    if (
      (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta')
      && typeof event.delta === 'string'
    ) {
      assistantBuffer += event.delta
      callbacks.onAssistantTranscript?.(assistantBuffer, false)
      setStatus('speaking')
      return
    }

    if (
      type === 'response.output_audio_transcript.done'
      || type === 'response.audio_transcript.done'
      || type === 'response.done'
    ) {
      if (assistantBuffer) callbacks.onAssistantTranscript?.(assistantBuffer, true)
      assistantBuffer = ''
      setStatus('listening')
      return
    }

    if (type === 'response.created') {
      assistantBuffer = ''
      setStatus('thinking')
    }
  }

  const interruptInternal = () => {
    sendEvent({ type: 'response.cancel' })
    sendEvent({ type: 'output_audio_buffer.clear' })
    try {
      if (remoteAudio) {
        remoteAudio.pause()
        // Keep srcObject; just pause — next track activity resumes via autoplay/ontrack.
      }
    } catch {
      // ignore
    }
  }

  return {
    getStatus: () => status,
    isConnected: () => Boolean(pc && dc && dc.readyState === 'open'),
    async connect() {
      if (disposed) return
      if (pc) return
      setStatus('connecting')

      const prefs = loadVoiceExperiencePrefs()
      const voice = prefs.voiceId === 'onyx' || prefs.gender === 'male' ? 'cedar' : 'marin'

      pc = new RTCPeerConnection()
      remoteAudio = document.createElement('audio')
      remoteAudio.autoplay = true
      remoteAudio.setAttribute('playsinline', 'true')
      remoteAudio.style.display = 'none'
      document.body.appendChild(remoteAudio)

      pc.ontrack = (e) => {
        if (!remoteAudio) return
        remoteAudio.srcObject = e.streams[0] ?? null
        void remoteAudio.play().catch(() => undefined)
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
        // Enable input transcription so UI can show what the traveler said.
        sendEvent({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: buildInstructions(),
            audio: {
              input: {
                transcription: { model: 'gpt-4o-mini-transcribe' },
                turn_detection: { type: 'server_vad', silence_duration_ms: 700 },
              },
              output: { voice },
            },
          },
        })
        callbacks.onConnected?.()
        setStatus('listening')
        logChat('debug', 'voice', 'realtime_connected', {
          model: REALTIME_PUBLIC_MODEL,
          voice,
        })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const res = await fetch('/api/openai/realtime-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          voice,
          instructions: buildInstructions(),
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
        try {
          dc?.close()
        } catch {
          // ignore
        }
        try {
          pc?.close()
        } catch {
          // ignore
        }
        try {
          localStream?.getTracks().forEach((t) => t.stop())
        } catch {
          // ignore
        }
        pc = null
        dc = null
        localStream = null
        throw new Error(`realtime_call_failed:${res.status}`)
      }

      const answerSdp = await res.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    },
    disconnect() {
      disposed = true
      interruptInternal()
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
      setStatus('idle')
      callbacks.onDisconnected?.()
    },
    interrupt() {
      interruptInternal()
      setStatus('listening')
    },
    sendText(text: string) {
      const cleaned = text.trim()
      if (!cleaned) return
      assistantBuffer = ''
      setStatus('thinking')
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
  }
}
