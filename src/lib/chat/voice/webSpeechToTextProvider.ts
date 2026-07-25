import type { SpeechToTextProvider, SpeechToTextStartOptions } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'
import { logPipeline } from '../pipelineDiagnostics'

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

/** Brief delay before restarting after WebKit ends a non-continuous turn. */
const SAFARI_RESTART_DELAY_MS = 180

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * iPhone/iPad Safari (and desktop Safari) do not reliably deliver transcripts when
 * `continuous=true`. Prefer one-shot recognition + controlled restart instead.
 */
export function prefersSafariSpeechRestart(userAgent?: string, maxTouchPoints?: number): boolean {
  if (typeof navigator === 'undefined' && userAgent == null) return false
  const ua = userAgent ?? navigator.userAgent ?? ''
  const touchPoints =
    typeof maxTouchPoints === 'number'
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
        ? navigator.maxTouchPoints ?? 0
        : 0
  const iOS =
    /iPad|iPhone|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && touchPoints > 1)
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|Android/i.test(ua)
  return iOS || safari
}

function detach(recognition: BrowserSpeechRecognition | null) {
  if (!recognition) return
  recognition.onresult = null
  recognition.onerror = null
  recognition.onend = null
}

export function createWebSpeechToTextProvider(): SpeechToTextProvider {
  let recognition: BrowserSpeechRecognition | null = null
  let finalTranscript = ''
  let intentionalStop = false
  let sessionActive = false
  let useSafariRestartLoop = false
  let resultCursor = 0
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  const clearRestartTimer = () => {
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const softStart = (rec: BrowserSpeechRecognition) => {
    try {
      rec.start()
      return true
    } catch {
      // WebKit often rejects an immediate restart — retry once after a short delay.
      clearRestartTimer()
      restartTimer = setTimeout(() => {
        restartTimer = null
        if (!sessionActive || intentionalStop || recognition !== rec) return
        try {
          rec.start()
        } catch (error) {
          logPipeline({
            stage: 'stt',
            event: 'provider_restart_failed',
            error,
            message: error instanceof Error ? error.message : String(error),
          })
          sessionActive = false
          provider.onError?.(
            error instanceof Error ? error.message : 'speech_recognition_restart_failed',
          )
          provider.onEnd?.()
        }
      }, SAFARI_RESTART_DELAY_MS)
      return false
    }
  }

  const provider: SpeechToTextProvider = {
    providerId: 'web-speech-stt',
    isSupported: () => !!getSpeechRecognitionCtor(),
    async start(options: SpeechToTextStartOptions) {
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor) throw new Error('التعرف على الكلام غير مدعوم في هذا المتصفح')
      clearRestartTimer()
      detach(recognition)
      finalTranscript = ''
      intentionalStop = false
      sessionActive = true
      resultCursor = 0
      useSafariRestartLoop = Boolean(options.continuous) && prefersSafariSpeechRestart()
      recognition = new Ctor()
      recognition.lang = speechLangForLocale(options.locale)
      // Safari/iOS: continuous=true often leaves UI listening with zero transcripts.
      recognition.continuous = useSafariRestartLoop ? false : options.continuous
      recognition.interimResults = options.interimResults
      recognition.onresult = (event) => {
        let interim = ''
        let newFinals = ''
        const start = Math.max(event.resultIndex, resultCursor)
        for (let i = start; i < event.results.length; i += 1) {
          const result = event.results[i]
          const text = result?.[0]?.transcript ?? ''
          if (result && (result as { isFinal?: boolean }).isFinal) {
            newFinals += text
            resultCursor = i + 1
          } else {
            interim += text
          }
        }
        if (newFinals) {
          finalTranscript = `${finalTranscript} ${newFinals}`.trim()
          provider.onFinal?.({ transcript: finalTranscript, isFinal: true })
        }
        if (interim) {
          const preview = `${finalTranscript} ${interim}`.trim()
          provider.onPartial?.({ transcript: preview, isFinal: false })
        }
      }
      recognition.onerror = (event) => {
        const error = event.error || 'speech_recognition_error'
        if (intentionalStop && (error === 'aborted' || error === 'no-speech')) return
        // Safari emits no-speech between one-shot turns while the session is still open.
        if (useSafariRestartLoop && sessionActive && error === 'no-speech') {
          return
        }
        logPipeline({ stage: 'stt', event: 'provider_error', message: error })
        provider.onError?.(error)
      }
      recognition.onend = () => {
        if (intentionalStop || !sessionActive) {
          clearRestartTimer()
          provider.onEnd?.()
          return
        }
        if (useSafariRestartLoop && recognition) {
          // Keep the outer voice session in "listening" — do not bubble onEnd
          // (that would race a second start via voiceSession.maybeResumeHandsFree).
          clearRestartTimer()
          restartTimer = setTimeout(() => {
            restartTimer = null
            if (!sessionActive || intentionalStop || !recognition) return
            softStart(recognition)
          }, SAFARI_RESTART_DELAY_MS)
          return
        }
        provider.onEnd?.()
      }
      try {
        recognition.start()
        logPipeline({
          stage: 'stt',
          event: 'provider_started',
          meta: {
            continuous: recognition.continuous,
            requestedContinuous: options.continuous,
            safariRestartLoop: useSafariRestartLoop,
            lang: recognition.lang,
          },
        })
      } catch (error) {
        sessionActive = false
        logPipeline({
          stage: 'stt',
          event: 'provider_start_failed',
          error,
          message: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    async stop() {
      intentionalStop = true
      sessionActive = false
      clearRestartTimer()
      const rec = recognition
      if (!rec) return finalTranscript.trim()

      return await new Promise<string>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          detach(rec)
          if (recognition === rec) recognition = null
          resolve(finalTranscript.trim())
        }
        const previousOnEnd = rec.onend
        rec.onend = () => {
          try {
            previousOnEnd?.()
          } finally {
            finish()
          }
        }
        try {
          rec.stop()
        } catch {
          finish()
          return
        }
        // Ensure we never hang if onend is skipped by the browser.
        setTimeout(finish, 800)
      })
    },
    abort() {
      intentionalStop = true
      sessionActive = false
      clearRestartTimer()
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
      detach(recognition)
      recognition = null
    },
  }

  return provider
}
