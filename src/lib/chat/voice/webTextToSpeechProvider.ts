import type { TextToSpeechProvider, TextToSpeechSpeakOptions } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'
import { unlockAudioPlayback } from './audioElementTextToSpeechProvider'

function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.onvoiceschanged = null
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.onvoiceschanged = done
    window.setTimeout(done, timeoutMs)
  })
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: 'ar' | 'en' | 'fr',
): SpeechSynthesisVoice | null {
  const prefix = locale === 'ar' ? 'ar' : locale === 'fr' ? 'fr' : 'en'
  const exactLang = locale === 'ar' ? 'ar-sa' : locale === 'fr' ? 'fr-fr' : 'en-us'
  const exact = voices.find((v) => v.lang?.toLowerCase() === exactLang)
  if (exact) return exact
  return voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ?? null
}

/**
 * Web Speech TTS with Chrome autoplay/paused mitigations.
 * Prefer audio-element TTS in production; this remains the offline fallback.
 */
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
      unlockAudioPlayback()
      stopped = false
      const synth = window.speechSynthesis

      if (options.interrupt !== false) {
        synth.cancel()
        // Chrome often leaves synthesis paused after cancel — resume before speak.
        await new Promise((r) => setTimeout(r, 40))
        try {
          synth.resume()
        } catch {
          // ignore
        }
      }

      const voices = await waitForVoices()
      const utterance = new SpeechSynthesisUtterance(options.text)
      utterance.lang = speechLangForLocale(options.locale)
      const match = pickVoice(voices, options.locale)
      if (match) utterance.voice = match
      utterance.rate = options.locale === 'ar' ? 0.95 : 1

      const token = ++generation
      await new Promise<void>((resolve, reject) => {
        speaking = true
        let started = false
        // Chrome bug: long utterances (and sometimes short ones after cancel)
        // get stuck in paused state. Keep kicking resume while we own this turn.
        const kick = window.setInterval(() => {
          if (token !== generation || stopped) {
            window.clearInterval(kick)
            return
          }
          try {
            if (synth.paused) synth.resume()
          } catch {
            // ignore
          }
        }, 200)

        const settle = (err?: Error) => {
          window.clearInterval(kick)
          if (token === generation) speaking = false
          if (err) reject(err)
          else resolve()
        }

        utterance.onstart = () => {
          started = true
          speaking = true
          try {
            synth.resume()
          } catch {
            // ignore
          }
        }
        utterance.onend = () => settle()
        utterance.onerror = (event) => {
          if (stopped || token !== generation) {
            settle()
            return
          }
          // Some browsers fire "interrupted" / "canceled" on intentional stop.
          const typ = (event as SpeechSynthesisErrorEvent).error
          if (typ === 'interrupted' || typ === 'canceled') {
            settle()
            return
          }
          settle(new Error('تعذر تشغيل الصوت'))
        }

        synth.speak(utterance)
        try {
          synth.resume()
        } catch {
          // ignore
        }

        // If nothing starts within 1.2s, treat as failure so callers can fall back.
        window.setTimeout(() => {
          if (token !== generation || stopped || started) return
          if (!synth.speaking && !synth.pending) {
            settle(new Error('تعذر تشغيل الصوت'))
          }
        }, 1200)
      })
    },
    stop() {
      stopped = true
      generation += 1
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
        try {
          window.speechSynthesis.resume()
        } catch {
          // ignore
        }
      }
      speaking = false
    },
    isSpeaking() {
      return speaking
    },
  }
}
