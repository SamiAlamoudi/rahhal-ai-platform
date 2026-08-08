/**
 * Realtime WebRTC transport — adapts createRealtimeWebRtcSession
 * onto BilamoVoiceTransport. Provider details stay in chat/voice.
 */

import {
  createRealtimeWebRtcSession,
  type RealtimeWebRtcSession,
} from '../../chat/voice/realtimeWebRtcSession'
import type { VoiceLocale } from '../../chat/voice/voiceTypes'
import type {
  BilamoSpeakHandle,
  BilamoSpeakRequest,
  BilamoVoiceConnectionState,
  BilamoVoiceTransport,
  BilamoVoiceTransportCallbacks,
} from './bilamoVoiceTransport'
import { emptyVoicePlaybackDiagnostics } from './voicePlaybackDiagnostics'

export type RealtimeTransportOptions = {
  /** Injected session factory for tests. */
  createSession?: typeof createRealtimeWebRtcSession
  /** Max reconnect attempts after unexpected disconnect. */
  maxReconnectAttempts?: number
}

export function createRealtimeWebRtcBilamoTransport(
  options: RealtimeTransportOptions = {},
): BilamoVoiceTransport {
  const createSession = options.createSession ?? createRealtimeWebRtcSession
  const maxReconnect = options.maxReconnectAttempts ?? 2

  let callbacks: BilamoVoiceTransportCallbacks = {}
  let session: RealtimeWebRtcSession | null = null
  let connectionState: BilamoVoiceConnectionState = 'idle'
  let speaking = false
  let listening = false
  let speakGen = 0
  let disposed = false
  let reconnectAttempts = 0
  let userWantsConnected = false
  /** Speak handles waiting on speaking-end callbacks. */
  const pendingSpeak = new Map<number, { resolve: () => void }>()
  const silentTimers = new Map<number, ReturnType<typeof setTimeout>>()
  /** Align with BilamoVoiceSession silent-realtime classic fallback window. */
  const SILENT_AUDIO_MS = 2_500

  const clearSilentTimer = (generation: number) => {
    const t = silentTimers.get(generation)
    if (t != null) {
      clearTimeout(t)
      silentTimers.delete(generation)
    }
  }

  const setConnection = (next: BilamoVoiceConnectionState) => {
    connectionState = next
    callbacks.onConnectionStateChange?.(next)
  }

  const bindSession = () => {
    session = createSession({
      onStatus: (status) => {
        if (status === 'listening') {
          listening = true
          callbacks.onListeningChange?.(true)
        } else if (status === 'speaking') {
          // Only mark audible speaking once the session reports speaking
          // (set after remote audio play() succeeds — not on speak() call).
          if (!speaking) {
            speaking = true
            clearSilentTimer(speakGen)
            callbacks.onSpeakingStart?.(speakGen)
            callbacks.onAudioChunk?.({ generation: speakGen })
          }
        } else if (status === 'idle' || status === 'error') {
          if (listening) {
            listening = false
            callbacks.onListeningChange?.(false)
          }
          if (speaking || pendingSpeak.has(speakGen)) {
            const gen = speakGen
            speaking = false
            clearSilentTimer(gen)
            callbacks.onSpeakingEnd?.(gen)
            pendingSpeak.get(gen)?.resolve()
            pendingSpeak.delete(gen)
          }
        } else if (status === 'thinking') {
          // processing — not speaking
          if (speaking) {
            const gen = speakGen
            speaking = false
            clearSilentTimer(gen)
            callbacks.onSpeakingEnd?.(gen)
            pendingSpeak.get(gen)?.resolve()
            pendingSpeak.delete(gen)
          }
        }
        if (status === 'connecting') setConnection('connecting')
        if (status === 'error') setConnection('error')
      },
      onUserTranscript: (text, isFinal, meta) => {
        const event = {
          text,
          isFinal,
          normalizedForExtract: meta?.normalizedForExtract,
          // French Realtime language still maps to Latin TTS locale ('en').
          locale: (meta?.conversationLanguage || 'en') as VoiceLocale,
        }
        if (isFinal) callbacks.onFinalTranscript?.(event)
        else callbacks.onPartialTranscript?.(event)
      },
      onError: (message) => {
        const playback = /تشغيل الصوت|playback/i.test(message)
        callbacks.onError?.(message, {
          code: playback ? 'playback_blocked' : 'realtime_error',
          recoverable: true,
        })
      },
      onConnected: () => {
        reconnectAttempts = 0
        setConnection('connected')
      },
      onDisconnected: () => {
        listening = false
        speaking = false
        callbacks.onListeningChange?.(false)
        if (disposed || !userWantsConnected) {
          setConnection('disconnected')
          return
        }
        // Bounded reconnect — never auto-reopen mic without user intent.
        if (reconnectAttempts < maxReconnect) {
          reconnectAttempts += 1
          setConnection('reconnecting')
          void session?.connect().catch(() => {
            setConnection('error')
            callbacks.onError?.('reconnect_failed', {
              code: 'reconnect_failed',
              recoverable: true,
            })
          })
        } else {
          setConnection('error')
          callbacks.onError?.('reconnect_exhausted', {
            code: 'reconnect_exhausted',
            recoverable: true,
          })
        }
      },
      onInterrupted: () => {
        const gen = speakGen
        speaking = false
        callbacks.onSpeakingEnd?.(gen)
        pendingSpeak.get(gen)?.resolve()
        pendingSpeak.delete(gen)
      },
    })
  }

  const transport: BilamoVoiceTransport = {
    kind: 'realtime_webrtc',

    setCallbacks(next) {
      callbacks = next || {}
    },

    async connect() {
      if (disposed) return
      userWantsConnected = true
      if (!session) bindSession()
      setConnection('connecting')
      try {
        await session!.connect()
        setConnection('connected')
      } catch (err) {
        setConnection('error')
        callbacks.onError?.(
          err instanceof Error ? err.message : 'Could not start voice',
          { code: 'connect_failed', recoverable: true },
        )
        throw err
      }
    },

    disconnect() {
      userWantsConnected = false
      transport.stopListening()
      speakGen += 1
      speaking = false
      session?.disconnect()
      setConnection('disconnected')
    },

    async startListening(locale?: VoiceLocale) {
      if (disposed) return false
      if (!session?.isConnected()) {
        try {
          await transport.connect()
        } catch {
          return false
        }
      }
      // Wire ASR language (ar/en/fr/es/…). Ignoring locale locked transcription to Arabic.
      if (locale) {
        session!.setInputLanguage(locale)
      }
      // User intent — ensureListening never auto-runs after reply.
      // Await mic acquisition so Safari second-turn cannot claim listening with a dead track.
      const ok = await session!.ensureListening()
      if (!ok) {
        listening = false
        callbacks.onListeningChange?.(false)
        return false
      }
      listening = true
      callbacks.onListeningChange?.(true)
      return true
    },

    stopListening() {
      // Soft stop — cancel pending ASR (visibility / barge cleanup). Does not submit.
      listening = false
      callbacks.onListeningChange?.(false)
      session?.releaseToIdle?.('stop_listening')
    },

    cancelListening() {
      listening = false
      callbacks.onListeningChange?.(false)
      session?.releaseToIdle?.('cancel_listening')
    },

    finalizeListening() {
      // End-of-speech / silence / intentional orb finalize — commit once.
      listening = false
      callbacks.onListeningChange?.(false)
      if (!session) return
      session.finalizeListening()
    },

    speak(request: BilamoSpeakRequest): BilamoSpeakHandle {
      const trimmed = request.text.trim()
      const generation = ++speakGen
      // Do NOT claim speaking until remote audio actually starts (onStatus speaking).

      let resolveDone!: () => void
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })
      pendingSpeak.set(generation, { resolve: resolveDone })

      if (!trimmed || !session) {
        speaking = false
        callbacks.onSpeakingEnd?.(generation)
        pendingSpeak.delete(generation)
        resolveDone()
        return { generation, done }
      }

      try {
        session.speakWrittenDraft(trimmed, { locale: request.locale })
      } catch {
        speaking = false
        clearSilentTimer(generation)
        callbacks.onSpeakingEnd?.(generation)
        pendingSpeak.delete(generation)
        resolveDone()
        return { generation, done }
      }

      // If remote audible playback never starts, signal silent playback for classic fallback.
      clearSilentTimer(generation)
      silentTimers.set(
        generation,
        globalThis.setTimeout(() => {
          if (!pendingSpeak.has(generation)) return
          // Do not treat transport "speaking" latch as audible proof — session decides.
          const diag = session?.getPlaybackDiagnostics?.()
          if (diag?.audioPlaybackStarted && diag?.audible) return
          callbacks.onSilentPlayback?.({
            generation,
            code: 'silent_realtime_timeout',
          })
          speaking = false
          callbacks.onSpeakingEnd?.(generation)
          pendingSpeak.get(generation)?.resolve()
          pendingSpeak.delete(generation)
          clearSilentTimer(generation)
        }, SILENT_AUDIO_MS),
      )

      // Absolute safety timeout — Realtime should fire speaking end via status.
      globalThis.setTimeout(() => {
        if (pendingSpeak.has(generation)) {
          speaking = false
          clearSilentTimer(generation)
          callbacks.onSpeakingEnd?.(generation)
          pendingSpeak.get(generation)?.resolve()
          pendingSpeak.delete(generation)
        }
      }, 120_000)

      return { generation, done }
    },

    interrupt() {
      for (const gen of silentTimers.keys()) clearSilentTimer(gen)
      speakGen += 1
      speaking = false
      for (const [, p] of pendingSpeak) p.resolve()
      pendingSpeak.clear()
      session?.interrupt()
    },

    stop() {
      transport.interrupt()
    },

    isSpeaking: () => speaking,
    isListening: () => listening,
    isConnected: () => Boolean(session?.isConnected()),
    getConnectionState: () => connectionState,
    getPlaybackDiagnostics: () => {
      const fromSession = session?.getPlaybackDiagnostics()
      if (fromSession) return fromSession
      return emptyVoicePlaybackDiagnostics()
    },

    dispose() {
      disposed = true
      userWantsConnected = false
      transport.interrupt()
      session?.dispose()
      session = null
      setConnection('idle')
    },
  }

  return transport
}
