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
      if (voice) {
        try {
          utterance.voice = voice
        } catch {
          // Headless / mocked voices may not be real SpeechSynthesisVoice instances.
          // Language tag is enough for the engine (and for our speak() mock).
        }
      }

      const token = ++generation
      await new Promise<void>((resolve, reject) => {
        let started = false
        let settled = false
        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          fn()
        }
        const markStart = () => {
          if (started || token !== generation || stopped) return
          started = true
          speaking = true
          options.onStart?.()
        }
        utterance.onstart = () => markStart()
        utterance.onend = () => {
          if (token === generation) speaking = false
          finish(() => resolve())
        }
        utterance.onerror = () => {
          if (token === generation) speaking = false
          if (stopped || token !== generation) {
            finish(() => resolve())
            return
          }
          finish(() => reject(new Error('تعذر تشغيل الصوت')))
        }
        try {
          window.speechSynthesis.speak(utterance)
          // Chromium occasionally omits onstart for short utterances; treat speak() as start
          // only when the engine reports speaking / pending shortly after enqueue.
          window.setTimeout(() => {
            if (token !== generation || stopped || started) return
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              markStart()
            }
          }, 0)
          // Safety: mocked engines that call onend via microtask must not hang forever.
          window.setTimeout(() => {
            if (token !== generation || settled) return
            if (started) {
              speaking = false
              finish(() => resolve())
            }
          }, 8000)
        } catch {
          speaking = false
          finish(() => reject(new Error('تعذر تشغيل الصوت')))
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
