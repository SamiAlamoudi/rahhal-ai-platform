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
import { speechLangForLocale } from '../../chat/voice/voiceTypes'
import { normalizeArabicAsrForExtraction } from '../../chat/voice/arabicAsrNormalize'
import { sanitizeArabicVoiceTranscript } from '../../chat/voice/sanitizeArabicVoiceTranscript'
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
  /** Latest interim hypothesis — promoted on silence/stop when no isFinal arrived. */
  let interimBuffer = ''
  let stopEpoch = 0

  const setConnection = (next: BilamoVoiceConnectionState) => {
    connectionState = next
    callbacks.onConnectionStateChange?.(next)
  }

  const promoteInterimToFinal = () => {
    const piece = interimBuffer.trim()
    interimBuffer = ''
    if (!piece) return
    if (!finalBuffer.trim()) {
      finalBuffer = piece
      return
    }
    // Final replaces interim — never append both (duplicate chat lines).
    if (
      finalBuffer.includes(piece)
      || piece.includes(finalBuffer)
      || piece.startsWith(finalBuffer)
    ) {
      finalBuffer = piece.length >= finalBuffer.length ? piece : finalBuffer
      return
    }
    finalBuffer = piece.length >= finalBuffer.length ? piece : finalBuffer
  }

  const emitFinalIfNeeded = () => {
    if (finalEmitted) return
    promoteInterimToFinal()
    const rawText = finalBuffer.trim()
    let transcript = rawText
    finalBuffer = ''
    interimBuffer = ''
    if (listenLocale === 'ar') {
      transcript = sanitizeArabicVoiceTranscript(transcript)
    }
    if (!transcript) return
    finalEmitted = true
    const normalized = listenLocale === 'ar'
      ? normalizeArabicAsrForExtraction(transcript)
      : undefined
    callbacks.onFinalTranscript?.({
      text: transcript,
      isFinal: true,
      rawText: rawText || undefined,
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
      interimBuffer = ''
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
      rec.lang = speechLangForLocale(locale)
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
          interimBuffer = ''
          finalBuffer = `${finalBuffer} ${added}`.trim()
          callbacks.onPartialTranscript?.({
            text: finalBuffer,
            isFinal: false,
            locale,
          })
        } else if (interim) {
          interimBuffer = interim.trim()
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
          && !interimBuffer.trim()
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
        // Emit before detaching so finals are not lost; clear after.
        emitFinalIfNeeded()
        if (recognition === rec) clearRecognition()
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
      promoteInterimToFinal()
      const rec = recognition
      const epoch = ++stopEpoch
      if (!rec) {
        emitFinalIfNeeded()
        return
      }
      try {
        rec.stop()
      } catch {
        emitFinalIfNeeded()
        clearRecognition()
        return
      }
      // Wait briefly for onend finals; fallback emit if browser never fires onend.
      // Exactly-once via finalEmitted. Do not bump speakGen (that cancels TTS).
      globalThis.setTimeout(() => {
        if (epoch !== stopEpoch) return
        emitFinalIfNeeded()
        if (recognition === rec) clearRecognition()
      }, 700)
    },

    cancelListening() {
      // Soft cancel — never emit a final (typed send must not spawn a voice turn).
      intentionalStop = true
      finalEmitted = true
      finalBuffer = ''
      interimBuffer = ''
      listening = false
      callbacks.onListeningChange?.(false)
      stopEpoch += 1
      const rec = recognition
      clearRecognition()
      if (!rec) return
      try {
        rec.abort()
      } catch {
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }
    },

    finalizeListening() {
      transport.stopListening()
    },

    speak(request: BilamoSpeakRequest): BilamoSpeakHandle {
      const trimmed = request.text.trim()
      const generation = ++speakGen
      // Speaking state flips only when playback actually starts (onAudioChunk / play).

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
          callbacks.onError?.('تعذر تشغيل الصوت.', {
              code: 'playback_unsupported',
              recoverable: true,
            })
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
          let playbackStarted = false
          await engine.speak({
            text: trimmed,
            locale,
            interrupt: true,
            dialect: locale === 'ar' ? 'saudi' : undefined,
            format: 'wav',
            speed: locale === 'ar' ? 0.98 : 1,
            onAudioPlaybackStart: () => {
              if (speakGen !== generation) return
              playbackStarted = true
              speaking = true
              callbacks.onSpeakingStart?.(generation)
              callbacks.onAudioChunk?.({ generation })
            },
            instructions:
              locale === 'ar'
                ? 'Speak warm Saudi-Gulf Arabic, natural consultant pacing, no theatrical accent.'
                : undefined,
          })
          if (speakGen === generation && !playbackStarted) {
            // Speak resolved without an audible start (Safari autoplay / empty buffer).
            callbacks.onError?.('تعذر تشغيل الصوت.', {
              code: 'playback_blocked',
              recoverable: true,
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          callbacks.onError?.(
            /تشغيل|autoplay|NotAllowed|play/i.test(message)
              ? 'تعذر تشغيل الصوت.'
              : 'تعذر توليد الصوت.',
            { code: 'playback_blocked', recoverable: true },
          )
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
