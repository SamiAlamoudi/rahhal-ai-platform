import type { TextToSpeechProvider, TextToSpeechSpeakOptions, VoiceLocale } from './voiceTypes'
import { speechLangForLocale } from './voiceTypes'
import { estimateTtsWatchdogMs } from './spokenAnswer'

/** Safari often needs a brief settle after cancel() before the next speak(). */
const POST_CANCEL_SETTLE_MS = 60
/** Chromium pauses long synthesis ~15s unless resume() is poked. */
const CHROME_RESUME_KEEPALIVE_MS = 8_000

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Browser SpeechSynthesis TTS.
 * Active implementation: window.speechSynthesis + SpeechSynthesisUtterance.
 * Callbacks: onstart / onend / onerror / onpause / onresume (+ duration watchdog).
 *
 * Hardening (Phase 2.6 production):
 * - Claim generation token before waitForVoices so stop() during queue cannot speak.
 * - Brief post-cancel settle for Safari.
 * - Chromium resume keepalive while speaking.
 */
export function createWebTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false
  let generation = 0
  let stopped = false
  let activeUtterance: SpeechSynthesisUtterance | null = null
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  let resumeKeepalive: ReturnType<typeof setInterval> | null = null
  /** Resolves the in-flight speak() promise when stop() interrupts. */
  let settleActiveSpeak: (() => void) | null = null

  const clearWatchdog = () => {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
  }

  const clearResumeKeepalive = () => {
    if (resumeKeepalive) {
      clearInterval(resumeKeepalive)
      resumeKeepalive = null
    }
  }

  const armResumeKeepalive = (token: number) => {
    clearResumeKeepalive()
    resumeKeepalive = setInterval(() => {
      if (token !== generation || stopped) {
        clearResumeKeepalive()
        return
      }
      if (typeof window === 'undefined' || !window.speechSynthesis) return
      try {
        // Chromium: resume() while speaking prevents the ~15s silent pause.
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
          window.speechSynthesis.resume()
        }
      } catch {
        /* ignore */
      }
    }, CHROME_RESUME_KEEPALIVE_MS)
  }

  return {
    providerId: 'web-speech-tts',
    isSupported: () => typeof window !== 'undefined' && !!window.speechSynthesis,
    async speak(options: TextToSpeechSpeakOptions) {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        throw new Error('تعذر تشغيل الصوت')
      }
      const text = options.text.trim()
      if (!text) return

      clearWatchdog()
      clearResumeKeepalive()
      // Claim this speak attempt before any await so stop()/newer speak supersedes it.
      const token = ++generation
      stopped = false

      if (options.interrupt !== false) {
        window.speechSynthesis.cancel()
        speaking = false
        activeUtterance = null
        await delay(POST_CANCEL_SETTLE_MS)
        if (stopped || token !== generation) return
      }

      const voices = await waitForVoices()
      // stop() or a newer speak() during waitForVoices / settle — do not call speak().
      if (stopped || token !== generation) return

      const voice = pickVoice(voices, options.locale)
      if (options.locale === 'ar' && !voice) {
        throw new Error('تعذر تشغيل الصوت')
      }

      const UtteranceCtor = window.SpeechSynthesisUtterance
      const utterance = new UtteranceCtor(text)
      utterance.lang = voice?.lang || speechLangForLocale(options.locale)
      if (voice) {
        try {
          utterance.voice = voice
        } catch {
          // Headless / mocked voices may not be real SpeechSynthesisVoice instances.
        }
      }

      activeUtterance = utterance
      const watchdogMs = estimateTtsWatchdogMs(text)

      await new Promise<void>((resolve, reject) => {
        let started = false
        let settled = false
        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          settleActiveSpeak = null
          clearWatchdog()
          clearResumeKeepalive()
          if (activeUtterance === utterance) activeUtterance = null
          fn()
        }
        settleActiveSpeak = () => {
          speaking = false
          options.onEnd?.()
          finish(() => resolve())
        }
        const markStart = () => {
          if (started || token !== generation || stopped) return
          started = true
          speaking = true
          options.onStart?.()
          armResumeKeepalive(token)
        }
        const armWatchdog = () => {
          clearWatchdog()
          watchdogTimer = setTimeout(() => {
            watchdogTimer = null
            if (token !== generation || settled) return
            // Safari/WebKit often skips onend — complete so the session cannot stick in SPEAKING.
            speaking = false
            try {
              window.speechSynthesis.cancel()
            } catch {
              /* ignore */
            }
            options.onTimeout?.()
            finish(() => resolve())
          }, watchdogMs)
        }

        utterance.onstart = () => {
          markStart()
          armWatchdog()
        }
        utterance.onend = () => {
          if (token !== generation) {
            finish(() => resolve())
            return
          }
          speaking = false
          options.onEnd?.()
          finish(() => resolve())
        }
        utterance.onerror = (event) => {
          if (token !== generation) {
            finish(() => resolve())
            return
          }
          speaking = false
          const errName = (event as SpeechSynthesisErrorEvent).error || 'synthesis_error'
          // cancel / interrupted from stop() is benign.
          if (stopped || errName === 'canceled' || errName === 'interrupted') {
            options.onEnd?.()
            finish(() => resolve())
            return
          }
          options.onError?.(errName)
          finish(() => reject(new Error('تعذر تشغيل الصوت')))
        }
        // Pause/resume must not complete the turn — Safari may pause during audio route changes.
        utterance.onpause = () => {
          /* keep waiting for onend / watchdog; keepalive will resume */
        }
        utterance.onresume = () => {
          if (token === generation && !stopped) speaking = true
        }

        try {
          window.speechSynthesis.speak(utterance)
          // Chromium occasionally omits onstart for short utterances.
          window.setTimeout(() => {
            if (token !== generation || stopped || started) return
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              markStart()
              armWatchdog()
            }
          }, 0)
          // Always arm a fallback watchdog even if onstart never fires (iOS Safari).
          armWatchdog()
        } catch {
          speaking = false
          options.onError?.('speak_threw')
          finish(() => reject(new Error('تعذر تشغيل الصوت')))
        }
      })
    },
    stop() {
      stopped = true
      generation += 1
      clearWatchdog()
      clearResumeKeepalive()
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      activeUtterance = null
      speaking = false
      const settle = settleActiveSpeak
      settleActiveSpeak = null
      settle?.()
    },
    isSpeaking() {
      return speaking
    },
  }
}
