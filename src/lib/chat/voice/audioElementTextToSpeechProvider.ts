/**
 * Reliable TTS via POST /api/tts → persistent HTMLAudioElement.
 *
 * Autoplay rule: browsers block `new Audio().play()` after an async AI turn
 * unless the *same* media element was unlocked during a user gesture (mic / send).
 * We keep one shared element, warm it with a silent clip on unlock, then reuse it.
 */
import type { TextToSpeechProvider, TextToSpeechSpeakOptions, VoiceLocale } from './voiceTypes'

let unlocked = false
let sharedAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let audioContext: AudioContext | null = null

/** Tiny silent WAV — primes autoplay permission after a click/tap. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

function getSharedAudio(): HTMLAudioElement {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio playback is only available in the browser.')
  }
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.setAttribute('playsinline', 'true')
    sharedAudio.setAttribute('webkit-playsinline', 'true')
    sharedAudio.preload = 'auto'
    sharedAudio.crossOrigin = 'anonymous'
  }
  return sharedAudio
}

function revokeActiveUrl(): void {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

async function resumeAudioContext(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const AC =
      window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AC()
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    // Brief near-silent tick keeps gesture→audio association alive.
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    gain.gain.value = 0.00001
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.start()
    osc.stop(audioContext.currentTime + 0.02)
  } catch {
    // Best-effort.
  }
}

/** Call from a user gesture (mic tap / send) before the async reply returns. */
export async function unlockAudioPlayback(): Promise<void> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return

  await resumeAudioContext()

  try {
    const audio = getSharedAudio()
    audio.muted = true
    audio.volume = 1
    audio.src = SILENT_WAV
    await audio.play().catch(() => undefined)
    audio.pause()
    audio.currentTime = 0
    audio.muted = false
    audio.removeAttribute('src')
    audio.load()
    unlocked = true
  } catch {
    unlocked = true
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

async function synthesizeViaApi(text: string, locale: VoiceLocale): Promise<Blob> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 20_000)
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
    if (blob.size < 64) throw new Error('تعذر توليد الصوت')
    return blob
  } finally {
    window.clearTimeout(timer)
  }
}

async function synthesizeViaEdgeBrowser(text: string, locale: VoiceLocale): Promise<Blob> {
  const { EdgeTTSBrowser } = await import('edge-tts-universal/browser')
  const voice = locale === 'en' ? 'en-US-JennyNeural' : 'ar-SA-ZariyahNeural'
  const tts = new EdgeTTSBrowser(text, voice, { rate: '-5%' })
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

async function fetchSpeechAudio(text: string, locale: VoiceLocale): Promise<Blob> {
  try {
    return await synthesizeViaApi(text, locale)
  } catch {
    return await synthesizeViaEdgeBrowser(text, locale)
  }
}

async function playOnSharedElement(
  blob: Blob,
  token: number,
  generationRef: { current: number },
): Promise<void> {
  if (!unlocked) {
    await unlockAudioPlayback()
  } else {
    await resumeAudioContext()
  }

  const audio = getSharedAudio()
  revokeActiveUrl()
  const objectUrl = URL.createObjectURL(blob)
  activeObjectUrl = objectUrl
  audio.src = objectUrl
  audio.currentTime = 0
  audio.muted = false
  audio.volume = 1

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      audio.onended = null
      audio.onerror = null
      audio.onplaying = null
      if (err) {
        revokeActiveUrl()
        reject(err)
      } else {
        revokeActiveUrl()
        resolve()
      }
    }

    if (token !== generationRef.current) {
      finish()
      return
    }

    audio.onended = () => finish()
    audio.onerror = () => finish(new Error('تعذر تشغيل الصوت'))

    const attempt = () => {
      const playAttempt = audio.play()
      if (playAttempt && typeof playAttempt.then === 'function') {
        playAttempt.catch(() => {
          void unlockAudioPlayback().then(() => {
            if (token !== generationRef.current) {
              finish()
              return
            }
            audio.muted = false
            audio.volume = 1
            void audio.play().then(() => {
              // playing
            }).catch(() => {
              finish(new Error('تعذر تشغيل الصوت — اسمح بالتشغيل التلقائي'))
            })
          })
        })
      }
    }

    attempt()
  })
}

export function createAudioElementTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false
  let generation = 0
  const generationRef = { current: 0 }

  return {
    providerId: 'audio-element-tts',
    isSupported: () => typeof window !== 'undefined' && typeof Audio !== 'undefined',
    async speak(options: TextToSpeechSpeakOptions) {
      const text = options.text.trim()
      if (!text) return

      if (options.interrupt !== false) {
        generation += 1
        speaking = false
        try {
          const audio = getSharedAudio()
          audio.pause()
        } catch {
          // ignore
        }
        revokeActiveUrl()
      }

      const token = ++generation
      generationRef.current = token
      speaking = true

      try {
        // Re-assert unlock association right before fetch completes path.
        if (!unlocked) await unlockAudioPlayback()

        const blob = await fetchSpeechAudio(text, options.locale)
        if (token !== generationRef.current) {
          speaking = false
          return
        }
        await playOnSharedElement(blob, token, generationRef)
      } finally {
        if (token === generationRef.current) speaking = false
      }
    },
    stop() {
      generation += 1
      generationRef.current = generation
      speaking = false
      try {
        if (sharedAudio) {
          sharedAudio.pause()
          sharedAudio.removeAttribute('src')
          sharedAudio.load()
        }
      } catch {
        // ignore
      }
      revokeActiveUrl()
    },
    isSpeaking() {
      return speaking
    },
  }
}
