import type { SpeechToTextProvider, SpeechToTextStartOptions } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number; [index: number]: ArrayLike<{ transcript: string }> & { isFinal?: boolean } } }) => void) | null
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

export function createWebSpeechToTextProvider(): SpeechToTextProvider {
  let recognition: BrowserSpeechRecognition | null = null
  let finalTranscript = ''

  const provider: SpeechToTextProvider = {
    providerId: 'web-speech-stt',
    isSupported: () => !!getSpeechRecognitionCtor(),
    async start(options: SpeechToTextStartOptions) {
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor) throw new Error('التعرف على الكلام غير مدعوم في هذا المتصفح')
      finalTranscript = ''
      recognition = new Ctor()
      recognition.lang = speechLangForLocale(options.locale)
      recognition.continuous = options.continuous
      recognition.interimResults = options.interimResults
      recognition.onresult = (event) => {
        let interim = ''
        let finals = ''
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i]
          const text = result[0]?.transcript ?? ''
          if ((result as { isFinal?: boolean }).isFinal) finals += text
          else interim += text
        }
        if (finals) {
          finalTranscript = `${finalTranscript} ${finals}`.trim()
          provider.onFinal?.({ transcript: finalTranscript, isFinal: true })
        } else if (interim) {
          provider.onPartial?.({ transcript: interim, isFinal: false })
        }
      }
      recognition.onerror = (event) => {
        provider.onError?.(event.error || 'speech_recognition_error')
      }
      recognition.onend = () => {
        provider.onEnd?.()
      }
      recognition.start()
    },
    async stop() {
      recognition?.stop()
      return finalTranscript.trim()
    },
    abort() {
      recognition?.abort()
      recognition = null
    },
  }

  return provider
}
