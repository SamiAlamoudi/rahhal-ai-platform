import type { TextToSpeechProvider, TextToSpeechSpeakOptions } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'

export function createWebTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false

  return {
    providerId: 'web-speech-tts',
    isSupported: () => typeof window !== 'undefined' && !!window.speechSynthesis,
    async speak(options: TextToSpeechSpeakOptions) {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        throw new Error('قراءة الصوت غير مدعومة في هذا المتصفح')
      }
      if (options.interrupt !== false) {
        window.speechSynthesis.cancel()
      }
      const utterance = new SpeechSynthesisUtterance(options.text)
      utterance.lang = speechLangForLocale(options.locale)
      const voices = window.speechSynthesis.getVoices()
      const match = voices.find((v) => v.lang?.toLowerCase().startsWith(options.locale === 'ar' ? 'ar' : 'en'))
      if (match) utterance.voice = match

      await new Promise<void>((resolve, reject) => {
        speaking = true
        utterance.onend = () => {
          speaking = false
          resolve()
        }
        utterance.onerror = () => {
          speaking = false
          reject(new Error('تعذر تشغيل الصوت'))
        }
        window.speechSynthesis.speak(utterance)
      })
    },
    stop() {
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
