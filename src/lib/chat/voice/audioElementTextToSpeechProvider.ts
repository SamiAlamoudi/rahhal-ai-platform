/**
 * Reliable TTS via Edge neural voices in-browser → HTMLAudioElement.
 * Falls back to POST /api/tts when the browser path fails.
 * Survives Chrome speechSynthesis autoplay/paused bugs; plays real MP3 audio.
 */
import type { TextToSpeechProvider, TextToSpeechSpeakOptions, VoiceLocale } from './voiceTypes'

let unlocked = false
let unlockAudio: HTMLAudioElement | null = null

/** Call from a user gesture (mic tap / send) before the async reply returns. */
export function unlockAudioPlayback(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return
  try {
    if (!unlockAudio) {
      // Tiny silent WAV — primes autoplay permission after a click/tap.
      unlockAudio = new Audio(
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
      )
      unlockAudio.preload = 'auto'
      unlockAudio.volume = 0.01
    }
    const play = unlockAudio.play()
    if (play && typeof play.then === 'function') {
      void play.then(() => {
        unlockAudio?.pause()
        if (unlockAudio) unlockAudio.currentTime = 0
        unlocked = true
      }).catch(() => {
        // Gesture may still unlock on the next real speak() call.
      })
    } else {
      unlocked = true
    }
  } catch {
    // Best-effort unlock.
  }

  // Also kick Web Speech in case we fall back later.
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume()
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
      window.speechSynthesis.cancel()
      window.speechSynthesis.resume()
    }
  } catch {
    // ignore
  }
}

export function isAudioPlaybackUnlocked(): boolean {
  return unlocked
}

function pickVoice(locale: VoiceLocale): string {
  return locale === 'en' ? 'en-US-JennyNeural' : 'ar-SA-ZariyahNeural'
}

async function synthesizeViaEdgeBrowser(text: string, locale: VoiceLocale): Promise<Blob> {
  const { EdgeTTSBrowser } = await import('edge-tts-universal/browser')
  const tts = new EdgeTTSBrowser(text, pickVoice(locale), { rate: '-5%' })
  const result = await tts.synthesize()
  const audio = result.audio as Blob | ArrayBuffer | { arrayBuffer: () => Promise<ArrayBuffer> }
  if (typeof Blob !== 'undefined' && audio instanceof Blob) return audio
  if (audio instanceof ArrayBuffer) {
    return new Blob([audio], { type: 'audio/mpeg' })
  }
  if (audio && typeof (audio as { arrayBuffer?: unknown }).arrayBuffer === 'function') {
    return new Blob([await (audio as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()], {
      type: 'audio/mpeg',
    })
  }
  throw new Error('empty_edge_audio')
}

async function synthesizeViaApi(text: string, locale: VoiceLocale): Promise<Blob> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `تعذر توليد الصوت (${response.status})`)
    }
    const blob = await response.blob()
    if (!blob.size || !(blob.type.includes('audio') || blob.type.includes('mpeg') || blob.type === '')) {
      // Some servers omit type; still accept non-tiny binary payloads.
      if (blob.size < 64) throw new Error('تعذر توليد الصوت')
    }
    return blob
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchSpeechAudio(text: string, locale: VoiceLocale): Promise<Blob> {
  try {
    return await synthesizeViaEdgeBrowser(text, locale)
  } catch {
    return await synthesizeViaApi(text, locale)
  }
}

export function createAudioElementTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false
  let generation = 0
  let current: HTMLAudioElement | null = null
  let objectUrl: string | null = null

  const cleanup = () => {
    if (current) {
      current.onended = null
      current.onerror = null
      current.onplaying = null
      try {
        current.pause()
      } catch {
        // ignore
      }
      current.src = ''
      current = null
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  }

  return {
    providerId: 'audio-element-tts',
    isSupported: () => typeof window !== 'undefined' && typeof Audio !== 'undefined',
    async speak(options: TextToSpeechSpeakOptions) {
      const text = options.text.trim()
      if (!text) return

      if (options.interrupt !== false) {
        generation += 1
        cleanup()
        speaking = false
      }

      const token = ++generation
      unlockAudioPlayback()

      const blob = await fetchSpeechAudio(text, options.locale)
      if (token !== generation) return

      cleanup()
      objectUrl = URL.createObjectURL(blob)
      const audio = new Audio(objectUrl)
      audio.preload = 'auto'
      current = audio

      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (err?: Error) => {
          if (settled) return
          settled = true
          if (token === generation) speaking = false
          cleanup()
          if (err) reject(err)
          else resolve()
        }

        audio.onplaying = () => {
          if (token === generation) speaking = true
        }
        audio.onended = () => finish()
        audio.onerror = () => finish(new Error('تعذر تشغيل الصوت'))

        const playAttempt = audio.play()
        if (playAttempt && typeof playAttempt.then === 'function') {
          playAttempt.then(() => {
            if (token === generation) speaking = true
          }).catch(() => {
            // Autoplay blocked — retry once after an explicit unlock kick.
            unlockAudioPlayback()
            void audio.play().then(() => {
              if (token === generation) speaking = true
            }).catch(() => finish(new Error('تعذر تشغيل الصوت — اسمح بالتشغيل التلقائي')))
          })
        }
      })
    },
    stop() {
      generation += 1
      speaking = false
      cleanup()
    },
    isSpeaking() {
      return speaking
    },
  }
}
