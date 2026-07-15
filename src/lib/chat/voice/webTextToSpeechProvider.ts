import type { TextToSpeechProvider, TextToSpeechSpeakOptions } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'

export function createWebTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false
  let generation = 0
  let stopped = false

  return {
    providerId: 'web-speech-tts',
    isSupported: () => typeof window !== 'undefined' && !!window.speechSynthesis,
    async speak(options: TextToSpeechSpeakOptions) {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        throw new Error('قراءة الصوت غير مدعومة في هذا المتصفح')
      }
      stopped = false
      if (options.interrupt !== false) {
        window.speechSynthesis.cancel()
      }
      const utterance = new SpeechSynthesisUtterance(options.text)
      utterance.lang = speechLangForLocale(options.locale)
      const voices = window.speechSynthesis.getVoices()
      const match = voices.find((v) => v.lang?.toLowerCase().startsWith(options.locale === 'ar' ? 'ar' : 'en'))
      if (match) utterance.voice = match

      const token = ++generation
      await new Promise<void>((resolve, reject) => {
        speaking = true
        utterance.onend = () => {
          if (token === generation) speaking = false
          resolve()
        }
        utterance.onerror = () => {
          if (token === generation) speaking = false
          // Intentional cancel/stop should not surface as failure
          if (stopped || token !== generation) {
            resolve()
            return
          }
          reject(new Error('تعذر تشغيل الصوت'))
        }
        window.speechSynthesis.speak(utterance)
      })
    },
    stop() {
      stopped = true
      generation += 1
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      speaking = false
    },
    isSpeaking() {
      return speaking
    },
  }
}
