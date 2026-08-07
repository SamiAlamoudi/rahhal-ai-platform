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
          speaking = true
          callbacks.onSpeakingStart?.(speakGen)
          callbacks.onAudioChunk?.({ generation: speakGen })
        } else if (status === 'idle' || status === 'error') {
          if (listening) {
            listening = false
            callbacks.onListeningChange?.(false)
          }
          if (speaking) {
            const gen = speakGen
            speaking = false
            callbacks.onSpeakingEnd?.(gen)
            pendingSpeak.get(gen)?.resolve()
            pendingSpeak.delete(gen)
          }
        } else if (status === 'thinking') {
          // processing — not speaking
          if (speaking) {
            const gen = speakGen
            speaking = false
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
          locale: (meta?.conversationLanguage === 'en' ? 'en' : 'ar') as VoiceLocale,
        }
        if (isFinal) callbacks.onFinalTranscript?.(event)
        else callbacks.onPartialTranscript?.(event)
      },
      onError: (message) => {
        callbacks.onError?.(message, { code: 'realtime_error', recoverable: true })
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
            callbacks.onError?.('Connection lost. You can retry or type instead.', {
              code: 'reconnect_failed',
              recoverable: true,
            })
          })
        } else {
          setConnection('error')
          callbacks.onError?.('Connection lost. You can retry or type instead.', {
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
      void locale
      if (disposed) return false
      if (!session?.isConnected()) {
        try {
          await transport.connect()
        } catch {
          return false
        }
      }
      // User intent — ensureListening never auto-runs after reply.
      session?.ensureListening()
      listening = true
      callbacks.onListeningChange?.(true)
      return true
    },

    stopListening() {
      listening = false
      callbacks.onListeningChange?.(false)
      session?.releaseToIdle('bilamo_stop_listening')
    },

    speak(request: BilamoSpeakRequest): BilamoSpeakHandle {
      const trimmed = request.text.trim()
      const generation = ++speakGen
      speaking = Boolean(trimmed)
      if (speaking) callbacks.onSpeakingStart?.(generation)

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
        callbacks.onSpeakingEnd?.(generation)
        pendingSpeak.delete(generation)
        resolveDone()
      }

      // Safety timeout — Realtime should fire speaking end via status.
      globalThis.setTimeout(() => {
        if (pendingSpeak.has(generation)) {
          speaking = false
          callbacks.onSpeakingEnd?.(generation)
          pendingSpeak.get(generation)?.resolve()
          pendingSpeak.delete(generation)
        }
      }, 120_000)

      return { generation, done }
    },

    interrupt() {
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
