import type { TextToSpeechProvider, TextToSpeechSpeakOptions, VoiceLocale } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'

function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener('voiceschanged', onChanged)
      resolve(window.speechSynthesis.getVoices())
    }
    const onChanged = () => finish()
    window.speechSynthesis.addEventListener('voiceschanged', onChanged)
    // Some browsers populate voices synchronously after a tick.
    window.setTimeout(finish, timeoutMs)
  })
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: VoiceLocale,
): SpeechSynthesisVoice | null {
  const prefix = locale === 'ar' ? 'ar' : 'en'
  const preferred = locale === 'ar' ? ['ar-SA', 'ar_SA', 'ar-EG', 'ar'] : ['en-US', 'en_US', 'en-GB', 'en']
  const matching = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix))
  if (!matching.length) return null
  for (const tag of preferred) {
    const hit = matching.find((v) => v.lang?.replace('_', '-').toLowerCase().startsWith(tag.toLowerCase()))
    if (hit) return hit
  }
  const local = matching.find((v) => v.localService)
  return local ?? matching[0] ?? null
}

export function createWebTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false
  let generation = 0
  let stopped = false

  return {
    providerId: 'web-speech-tts',
    isSupported: () => typeof window !== 'undefined' && !!window.speechSynthesis,
    async speak(options: TextToSpeechSpeakOptions) {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        throw new Error('تعذر تشغيل الصوت')
      }
      const text = options.text.trim()
      if (!text) return

      stopped = false
      if (options.interrupt !== false) {
        window.speechSynthesis.cancel()
        speaking = false
      }

      const voices = await waitForVoices()
      const voice = pickVoice(voices, options.locale)
      if (options.locale === 'ar' && !voice) {
        throw new Error('تعذر تشغيل الصوت')
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voice?.lang || speechLangForLocale(options.locale)
      if (voice) utterance.voice = voice

      const token = ++generation
      await new Promise<void>((resolve, reject) => {
        utterance.onstart = () => {
          if (token !== generation || stopped) return
          speaking = true
          options.onStart?.()
        }
        utterance.onend = () => {
          if (token === generation) speaking = false
          resolve()
        }
        utterance.onerror = () => {
          if (token === generation) speaking = false
          if (stopped || token !== generation) {
            resolve()
            return
          }
          reject(new Error('تعذر تشغيل الصوت'))
        }
        try {
          window.speechSynthesis.speak(utterance)
        } catch {
          speaking = false
          reject(new Error('تعذر تشغيل الصوت'))
        }
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
