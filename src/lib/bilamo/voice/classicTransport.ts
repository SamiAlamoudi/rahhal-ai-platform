/**
 * Classic Bilamo transport — browser STT + one-shot TTS.
 * Production-safe fallback when WebRTC is unavailable.
 */

import {
  preconnectOpenAiTtsRoute,
  unlockAudioPlayback,
} from '../../chat/voice/audioElementTextToSpeechProvider'
import { createTextToSpeechProvider } from '../../chat/voice/voiceProviderFactory'
import type { TextToSpeechProvider, VoiceLocale } from '../../chat/voice/voiceTypes'
import { normalizeArabicAsrForExtraction } from '../../chat/voice/arabicAsrNormalize'
import type {
  BilamoSpeakHandle,
  BilamoSpeakRequest,
  BilamoVoiceConnectionState,
  BilamoVoiceTransport,
  BilamoVoiceTransportCallbacks,
} from './bilamoVoiceTransport'

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> & {
      length: number
    }
  }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function createClassicBilamoTransport(): BilamoVoiceTransport {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  let tts: TextToSpeechProvider | null = null
  let recognition: BrowserSpeechRecognition | null = null
  let connectionState: BilamoVoiceConnectionState = 'idle'
  let speaking = false
  let listening = false
  let speakGen = 0
  let disposed = false
  let intentionalStop = false
  let finalBuffer = ''
  let listenLocale: VoiceLocale = 'en'
  let finalEmitted = false

  const setConnection = (next: BilamoVoiceConnectionState) => {
    connectionState = next
    callbacks.onConnectionStateChange?.(next)
  }

  const emitFinalIfNeeded = () => {
    if (finalEmitted) return
    const transcript = finalBuffer.trim()
    finalBuffer = ''
    if (!transcript) return
    finalEmitted = true
    const normalized = listenLocale === 'ar'
      ? normalizeArabicAsrForExtraction(transcript)
      : undefined
    callbacks.onFinalTranscript?.({
      text: transcript,
      isFinal: true,
      normalizedForExtract: normalized && normalized !== transcript ? normalized : undefined,
      locale: listenLocale,
    })
  }

  const ensureTts = () => {
    if (!tts) {
      tts = createTextToSpeechProvider()
      try {
        preconnectOpenAiTtsRoute()
      } catch {
        /* ignore */
      }
    }
    return tts
  }

  const clearRecognition = () => {
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition = null
  }

  const transport: BilamoVoiceTransport = {
    kind: 'classic_tts',

    setCallbacks(next) {
      callbacks = next || {}
    },

    async connect() {
      if (disposed) return
      setConnection('connecting')
      ensureTts()
      await unlockAudioPlayback().catch(() => undefined)
      setConnection('connected')
    },

    disconnect() {
      transport.stopListening()
      speakGen += 1
      speaking = false
      try {
        tts?.stop()
      } catch {
        /* ignore */
      }
      setConnection('disconnected')
    },

    async startListening(locale: VoiceLocale = 'en') {
      if (disposed) return false
      intentionalStop = false
      finalBuffer = ''
      finalEmitted = false
      listenLocale = locale
      const Ctor = getSpeechCtor()
      if (!Ctor) {
        callbacks.onError?.('Speech recognition is not supported in this browser', {
          code: 'unsupported_browser',
          recoverable: true,
        })
        return false
      }
      // Stop prior recognition without emitting a stale final.
      intentionalStop = true
      try {
        recognition?.abort()
      } catch {
        try {
          recognition?.stop()
        } catch {
          /* ignore */
        }
      }
      clearRecognition()
      intentionalStop = false
      const rec = new Ctor()
      recognition = rec
      rec.lang = locale === 'ar' ? 'ar-SA' : 'en-US'
      rec.continuous = true
      rec.interimResults = true
      let reconnectAttempted = false

      rec.onresult = (event) => {
        let interim = ''
        let added = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const text = result?.[0]?.transcript ?? ''
          if (result && (result as { isFinal?: boolean }).isFinal) {
            added += text
          } else {
            interim += text
          }
        }
        if (added) {
          finalBuffer = `${finalBuffer} ${added}`.trim()
          callbacks.onPartialTranscript?.({
            text: finalBuffer,
            isFinal: false,
            locale,
          })
        } else if (interim) {
          callbacks.onPartialTranscript?.({
            text: `${finalBuffer} ${interim}`.trim(),
            isFinal: false,
            locale,
          })
        }
      }

      rec.onerror = (event) => {
        const code = event.error || 'speech_error'
        if (intentionalStop && (code === 'aborted' || code === 'no-speech')) return
        if (code === 'no-speech') return
        if (!intentionalStop && !reconnectAttempted && (code === 'network' || code === 'aborted')) {
          reconnectAttempted = true
          try {
            rec.start()
            return
          } catch {
            /* fall through */
          }
        }
        listening = false
        callbacks.onListeningChange?.(false)
        callbacks.onError?.(code === 'not-allowed' ? 'Microphone needs permission' : code, {
          code,
          recoverable: true,
        })
      }

      rec.onend = () => {
        if (
          !intentionalStop
          && !reconnectAttempted
          && !finalBuffer.trim()
          && recognition === rec
        ) {
          reconnectAttempted = true
          try {
            rec.start()
            listening = true
            callbacks.onListeningChange?.(true)
            return
          } catch {
            /* fall through */
          }
        }
        listening = false
        callbacks.onListeningChange?.(false)
        clearRecognition()
        emitFinalIfNeeded()
      }

      try {
        rec.start()
        listening = true
        callbacks.onListeningChange?.(true)
        return true
      } catch (err) {
        clearRecognition()
        listening = false
        callbacks.onError?.(
          err instanceof Error ? err.message : 'Could not start listening',
          { code: 'listen_failed', recoverable: true },
        )
        return false
      }
    },

    stopListening() {
      intentionalStop = true
      listening = false
      callbacks.onListeningChange?.(false)
      try {
        recognition?.stop()
      } catch {
        /* ignore */
      }
      clearRecognition()
      // User/silence stop must still deliver the final transcript once.
      emitFinalIfNeeded()
    },

    speak(request: BilamoSpeakRequest): BilamoSpeakHandle {
      const trimmed = request.text.trim()
      const generation = ++speakGen
      speaking = Boolean(trimmed)
      if (speaking) callbacks.onSpeakingStart?.(generation)

      const done = (async () => {
        if (!trimmed || disposed) {
          if (speakGen === generation) {
            speaking = false
            callbacks.onSpeakingEnd?.(generation)
          }
          return
        }
        const engine = ensureTts()
        if (!engine?.isSupported()) {
          if (speakGen === generation) {
            speaking = false
            callbacks.onSpeakingEnd?.(generation)
          }
          return
        }
        try {
          try {
            engine.stop()
          } catch {
            /* ignore */
          }
          await unlockAudioPlayback().catch(() => undefined)
          if (speakGen !== generation) return
          const locale = request.locale
          engine.prefetch?.({
            text: trimmed,
            locale,
            dialect: locale === 'ar' ? 'saudi' : undefined,
            format: 'wav',
            speed: locale === 'ar' ? 0.98 : 1,
          })
          if (speakGen !== generation) return
          callbacks.onAudioChunk?.({ generation })
          await engine.speak({
            text: trimmed,
            locale,
            interrupt: true,
            dialect: locale === 'ar' ? 'saudi' : undefined,
            format: 'wav',
            speed: locale === 'ar' ? 0.98 : 1,
            instructions:
              locale === 'ar'
                ? 'Speak warm Saudi-Gulf Arabic, natural consultant pacing, no theatrical accent.'
                : undefined,
          })
        } catch {
          /* soft-fail */
        } finally {
          if (speakGen === generation) {
            speaking = false
            callbacks.onSpeakingEnd?.(generation)
          }
        }
      })()

      return { generation, done }
    },

    interrupt() {
      speakGen += 1
      speaking = false
      try {
        tts?.stop()
      } catch {
        /* ignore */
      }
    },

    stop() {
      transport.interrupt()
    },

    isSpeaking: () => speaking,
    isListening: () => listening,
    isConnected: () => connectionState === 'connected' || connectionState === 'connecting',
    getConnectionState: () => connectionState,

    dispose() {
      disposed = true
      transport.disconnect()
      setConnection('idle')
    },
  }

  return transport
}
