import type { SpeechToTextProvider, SpeechToTextStartOptions, VoiceLocale } from './voiceTypes'
import {
  DEFAULT_ARABIC_SPEECH_LANG,
  FALLBACK_ARABIC_SPEECH_LANG,
  speechLangFallbacksForLocale,
  speechLangForLocale,
} from './voiceTypes'
import { isClearlyEnglish } from './speechCleanup'
import { logPipeline } from '../pipelineDiagnostics'

type SpeechAlternative = { transcript: string; confidence?: number }

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<ArrayLike<SpeechAlternative> & { isFinal?: boolean }> & {
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

function readConfidence(alt: SpeechAlternative | undefined): number | undefined {
  const value = alt?.confidence
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(1, value))
}

function averageConfidence(values: number[]): number | undefined {
  if (!values.length) return undefined
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Resolve initial recognition language.
 * Arabic UI/locale always starts ar-SA (never en-US). English locale uses en-US.
 */
export function resolveInitialSpeechLang(
  locale: VoiceLocale,
  opts?: { allowEnglish?: boolean },
): string {
  if (locale === 'en' || opts?.allowEnglish) {
    return speechLangForLocale('en')
  }
  return DEFAULT_ARABIC_SPEECH_LANG
}

export function createWebSpeechToTextProvider(): SpeechToTextProvider {
  let recognition: BrowserSpeechRecognition | null = null
  let finalTranscript = ''
  let intentionalStop = false
  let resultCursor = 0
  let activeLocale: VoiceLocale = 'ar'
  let langIndex = 0
  let langTags: string[] = [DEFAULT_ARABIC_SPEECH_LANG]
  let switchedToEnglish = false
  let confidenceSamples: number[] = []
  let startOptions: SpeechToTextStartOptions | null = null
  let restartingForLang = false

  const restartWithLang = async (lang: string) => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor || !startOptions) return
    restartingForLang = true
    intentionalStop = true
    try {
      recognition?.abort()
    } catch {
      // ignore
    }
    detach(recognition)
    recognition = null
    intentionalStop = false
    restartingForLang = false
    resultCursor = 0
    // Keep accumulated finals across language fallback/switch.
    recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = startOptions.continuous
    recognition.interimResults = startOptions.interimResults
    recognition.maxAlternatives = 1
    wireHandlers(recognition)
    recognition.start()
    logPipeline({
      stage: 'stt',
      event: 'provider_lang_switched',
      meta: { lang, locale: activeLocale },
    })
  }

  const wireHandlers = (rec: BrowserSpeechRecognition) => {
    rec.onresult = (event) => {
      let interim = ''
      let newFinals = ''
      const batchConfidence: number[] = []
      const start = Math.max(event.resultIndex, resultCursor)
      for (let i = start; i < event.results.length; i += 1) {
        const result = event.results[i]
        const alt = result?.[0]
        const text = alt?.transcript ?? ''
        const conf = readConfidence(alt)
        if (conf != null && conf > 0) batchConfidence.push(conf)
        if (result && (result as { isFinal?: boolean }).isFinal) {
          newFinals += text
          resultCursor = i + 1
        } else {
          interim += text
        }
      }
      if (batchConfidence.length) {
        confidenceSamples.push(...batchConfidence)
      }
      const confAvg = averageConfidence(batchConfidence)

      // Soft English switch: only after user clearly speaks English; never default-start en-US.
      const previewForDetect = `${finalTranscript} ${newFinals} ${interim}`.trim()
      if (
        activeLocale === 'ar'
        && !switchedToEnglish
        && isClearlyEnglish(previewForDetect)
      ) {
        switchedToEnglish = true
        void restartWithLang('en-US')
        return
      }

      if (newFinals) {
        finalTranscript = `${finalTranscript} ${newFinals}`.trim()
        provider.onFinal?.({
          transcript: finalTranscript,
          isFinal: true,
          confidence: confAvg ?? averageConfidence(confidenceSamples),
        })
      }
      if (interim) {
        const preview = `${finalTranscript} ${interim}`.trim()
        provider.onPartial?.({
          transcript: preview,
          isFinal: false,
          confidence: confAvg,
        })
      }
    }
    rec.onerror = (event) => {
      const error = event.error || 'speech_recognition_error'
      if (intentionalStop && (error === 'aborted' || error === 'no-speech')) return
      // Arabic fallback: ar-SA → ar when the primary tag is rejected.
      if (
        (error === 'language-not-supported' || error === 'service-not-allowed')
        && activeLocale === 'ar'
        && langIndex + 1 < langTags.length
        && rec.lang === langTags[langIndex]
      ) {
        langIndex += 1
        const next = langTags[langIndex] ?? FALLBACK_ARABIC_SPEECH_LANG
        logPipeline({
          stage: 'stt',
          event: 'provider_lang_fallback',
          message: error,
          meta: { from: rec.lang, to: next },
        })
        void restartWithLang(next)
        return
      }
      logPipeline({ stage: 'stt', event: 'provider_error', message: error })
      provider.onError?.(error)
    }
    rec.onend = () => {
      if (restartingForLang) return
      provider.onEnd?.()
    }
  }

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
      confidenceSamples = []
      switchedToEnglish = false
      restartingForLang = false
      startOptions = options
      activeLocale = options.locale
      langTags = speechLangFallbacksForLocale(options.locale)
      langIndex = 0
      const initialLang = resolveInitialSpeechLang(options.locale)
      recognition = new Ctor()
      recognition.lang = initialLang
      recognition.continuous = options.continuous
      recognition.interimResults = options.interimResults
      recognition.maxAlternatives = 1
      wireHandlers(recognition)
      try {
        recognition.start()
        logPipeline({
          stage: 'stt',
          event: 'provider_started',
          meta: {
            continuous: options.continuous,
            lang: recognition.lang,
            locale: options.locale,
            fallbacks: langTags,
          },
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
