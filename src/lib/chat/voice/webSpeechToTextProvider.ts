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

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
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
  let resultCursor = 0

  const provider: SpeechToTextProvider = {
    providerId: 'web-speech-stt',
    isSupported: () => !!getSpeechRecognitionCtor(),
    async start(options: SpeechToTextStartOptions) {
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor) throw new Error('التعرف على الكلام غير مدعوم في هذا المتصفح')
      detach(recognition)
      finalTranscript = ''
      intentionalStop = false
      resultCursor = 0
      recognition = new Ctor()
      recognition.lang = speechLangForLocale(options.locale)
      recognition.continuous = options.continuous
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
        logPipeline({ stage: 'stt', event: 'provider_error', message: error })
        provider.onError?.(error)
      }
      recognition.onend = () => {
        provider.onEnd?.()
      }
      try {
        recognition.start()
        logPipeline({
          stage: 'stt',
          event: 'provider_started',
          meta: { continuous: options.continuous, lang: recognition.lang },
        })
      } catch (error) {
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
