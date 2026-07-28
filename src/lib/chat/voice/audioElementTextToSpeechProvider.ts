/**
 * Reliable TTS via POST /api/tts → DOM-attached HTMLAudioElement.
 *
 * Autoplay rules (Chrome/Safari):
 * - Unlock must happen during a user gesture (mic / send).
 * - Unlock must NOT mutate the playback element (no src wipe / load()).
 * - The playback element should live in the DOM (Safari is picky).
 */
import type { TextToSpeechProvider, TextToSpeechSpeakOptions, VoiceLocale } from './voiceTypes'

let unlocked = false
let sharedAudio: HTMLAudioElement | null = null
let sharedAudioB: HTMLAudioElement | null = null
let unlockWarmAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let activeObjectUrlB: string | null = null
let useBufferB = false
let audioContext: AudioContext | null = null

/** Tiny silent WAV — primes autoplay permission after a click/tap. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

function createHiddenAudio(tag: string): HTMLAudioElement {
  const el = document.createElement('audio')
  el.setAttribute('playsinline', 'true')
  el.setAttribute('webkit-playsinline', 'true')
  el.setAttribute('data-rahhal-tts', tag)
  el.preload = 'auto'
  el.controls = false
  el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-9999px;'
  document.body.appendChild(el)
  return el
}

function ensurePlaybackAudio(): HTMLAudioElement {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio playback is only available in the browser.')
  }
  if (!sharedAudio) {
    sharedAudio = createHiddenAudio('playback-a')
  } else if (!sharedAudio.isConnected && document.body) {
    document.body.appendChild(sharedAudio)
  }
  return sharedAudio
}

/** Second buffer for gapless mid-reply clips (ChatGPT-like continuity). */
function ensurePlaybackAudioB(): HTMLAudioElement {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    throw new Error('Audio playback is only available in the browser.')
  }
  if (!sharedAudioB) {
    sharedAudioB = createHiddenAudio('playback-b')
  } else if (!sharedAudioB.isConnected && document.body) {
    document.body.appendChild(sharedAudioB)
  }
  return sharedAudioB
}

function revokeActiveUrl(): void {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

function revokeActiveUrlB(): void {
  if (activeObjectUrlB) {
    URL.revokeObjectURL(activeObjectUrlB)
    activeObjectUrlB = null
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

/**
 * Call from a user gesture (mic tap / send) before the async reply returns.
 * Uses a *separate* warm-up element so we never wipe the playback element's src.
 */
export async function unlockAudioPlayback(): Promise<void> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return

  await resumeAudioContext()

  // Ensure playback node exists in the DOM under the gesture stack.
  try {
    ensurePlaybackAudio()
  } catch {
    // ignore
  }

  // Prefetch Edge neural TTS module + warm a tiny Arabic neural synth for TTFB.
  void import('edge-tts-universal/browser')
    .then(async ({ EdgeTTSBrowser }) => {
      try {
        const warm = new EdgeTTSBrowser('مرحبا', 'ar-SA-ZariyahNeural', {
          rate: '-10.00%',
          pitch: '+0Hz',
        })
        await Promise.race([
          warm.synthesize(),
          new Promise<void>((resolve) => { window.setTimeout(resolve, 2500) }),
        ])
      } catch {
        // Best-effort warm-up only.
      }
    })
    .catch(() => undefined)

  try {
    if (!unlockWarmAudio) {
      unlockWarmAudio = new Audio(SILENT_WAV)
      unlockWarmAudio.setAttribute('playsinline', 'true')
      unlockWarmAudio.preload = 'auto'
      unlockWarmAudio.volume = 0.01
    } else {
      unlockWarmAudio.src = SILENT_WAV
    }
    await unlockWarmAudio.play().catch(() => undefined)
    unlockWarmAudio.pause()
    try {
      unlockWarmAudio.currentTime = 0
    } catch {
      // ignore
    }
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
  // Prefer OpenAI gpt-4o-mini-tts (ChatGPT-like) via same-origin proxy.
  try {
    const openaiRes = await fetch('/api/openai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale }),
    })
    if (openaiRes.ok) {
      const blob = await openaiRes.blob()
      if (blob.size >= 64) return blob
    }
  } catch {
    // Fall through to legacy /api/tts
  }

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

/**
 * ChatGPT Voice parity: OpenAI TTS first, then Edge neural, never robotic gTTS for Arabic.
 */
async function fetchSpeechAudio(text: string, locale: VoiceLocale): Promise<Blob> {
  // 1) OpenAI speech (closest to ChatGPT Voice)
  try {
    const openaiRes = await fetch('/api/openai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale }),
    })
    if (openaiRes.ok) {
      const blob = await openaiRes.blob()
      if (blob.size >= 64) return blob
    }
  } catch {
    // continue
  }

  // 2) Edge neural (browser) as backup
  try {
    return await synthesizeViaEdgeBrowser(text, locale)
  } catch {
    if (locale === 'ar') {
      try {
        const { EdgeTTSBrowser } = await import('edge-tts-universal/browser')
        const tts = new EdgeTTSBrowser(text, 'ar-SA-HamedNeural', { rate: '-4.00%', pitch: '+0Hz' })
        const result = await Promise.race([
          tts.synthesize(),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error('edge_tts_timeout')), 8_000)
          }),
        ])
        const audio = result.audio as Blob | ArrayBuffer | { arrayBuffer: () => Promise<ArrayBuffer> }
        if (typeof Blob !== 'undefined' && audio instanceof Blob) return audio
        if (audio instanceof ArrayBuffer) return new Blob([audio], { type: 'audio/mpeg' })
        if (audio && typeof (audio as { arrayBuffer?: unknown }).arrayBuffer === 'function') {
          return new Blob(
            [await (audio as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()],
            { type: 'audio/mpeg' },
          )
        }
      } catch {
        // fall through
      }
      throw new Error('arabic_tts_unavailable')
    }
    return await synthesizeViaApi(text, locale)
  }
}

async function synthesizeViaEdgeBrowser(text: string, locale: VoiceLocale): Promise<Blob> {
  const { EdgeTTSBrowser } = await import('edge-tts-universal/browser')
  // Conversational Arabic neural — slight slowdown for clarity without dragging.
  const voice = locale === 'en' ? 'en-US-JennyNeural' : 'ar-SA-ZariyahNeural'
  const tts = new EdgeTTSBrowser(text, voice, {
    rate: locale === 'ar' ? '-5.00%' : '-2.00%',
    pitch: '+0Hz',
  })
  const result = await Promise.race([
    tts.synthesize(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('edge_tts_timeout')), 8_000)
    }),
  ])
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

function playBlobOnElement(audio: HTMLAudioElement, blob: Blob, useB: boolean): Promise<void> {
  if (useB) revokeActiveUrlB()
  else revokeActiveUrl()
  const objectUrl = URL.createObjectURL(blob)
  if (useB) activeObjectUrlB = objectUrl
  else activeObjectUrl = objectUrl
  audio.src = objectUrl
  audio.currentTime = 0
  audio.muted = false
  audio.volume = 1

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      activePlayFinish = null
      audio.onended = null
      audio.onerror = null
      audio.onplaying = null
      if (err) {
        if (useB) revokeActiveUrlB()
        else revokeActiveUrl()
        reject(err)
      } else {
        resolve()
      }
    }

    activePlayFinish = finish

    audio.onended = () => {
      if (useB) revokeActiveUrlB()
      else revokeActiveUrl()
      finish()
    }
    audio.onerror = () => finish(new Error('تعذر تشغيل الصوت'))

    const attemptPlay = () => {
      if (settled) return
      const playAttempt = audio.play()
      if (playAttempt && typeof playAttempt.then === 'function') {
        playAttempt.then(() => {
          // Playing — wait for ended.
        }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          finish(new Error(`تعذر تشغيل الصوت — اسمح بالتشغيل التلقائي (${message})`))
        })
      }
    }

    if (audio.readyState >= 2) {
      attemptPlay()
    } else {
      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay)
        attemptPlay()
      }
      audio.addEventListener('canplay', onCanPlay)
      // Fail fast into play — waiting 1.5s feels like ChatGPT silence.
      window.setTimeout(() => {
        audio.removeEventListener('canplay', onCanPlay)
        if (!settled) attemptPlay()
      }, 400)
    }
  })
}

/** Settles an in-flight play() so voiceSession onComplete can resume listening. */
let activePlayFinish: ((err?: Error) => void) | null = null

const prefetchCache = new Map<string, Promise<Blob>>()

function prefetchKey(locale: VoiceLocale, text: string): string {
  return `${locale}\0${text}`
}

export function createAudioElementTextToSpeechProvider(): TextToSpeechProvider {
  let speaking = false
  let generation = 0

  return {
    providerId: 'audio-element-tts',
    isSupported: () => typeof window !== 'undefined' && typeof Audio !== 'undefined',
    prefetch(options) {
      const text = options.text.trim()
      if (!text || typeof window === 'undefined') return
      const key = prefetchKey(options.locale, text)
      if (prefetchCache.has(key)) return
      const pending = fetchSpeechAudio(text, options.locale)
        .catch((error) => {
          prefetchCache.delete(key)
          throw error
        })
      prefetchCache.set(key, pending)
      // Bound cache size — keep latest handful of phrases.
      if (prefetchCache.size > 8) {
        const oldest = prefetchCache.keys().next().value
        if (oldest) prefetchCache.delete(oldest)
      }
    },
    async speak(options: TextToSpeechSpeakOptions) {
      const text = options.text.trim()
      if (!text) return

      if (options.interrupt !== false) {
        generation += 1
        speaking = false
        useBufferB = false
        try {
          sharedAudio?.pause()
          sharedAudioB?.pause()
        } catch {
          // ignore
        }
        // Resolve any prior play promise so callers are not stuck.
        activePlayFinish?.()
        activePlayFinish = null
        revokeActiveUrl()
        revokeActiveUrlB()
      }

      const token = ++generation
      speaking = true

      try {
        if (!unlocked) {
          await unlockAudioPlayback()
        } else {
          await resumeAudioContext()
        }

        const key = prefetchKey(options.locale, text)
        const pending = prefetchCache.get(key) ?? fetchSpeechAudio(text, options.locale)
        prefetchCache.delete(key)
        const blob = await pending
        if (token !== generation) {
          speaking = false
          return
        }

        // Alternate A/B elements so the next clip can be decoded while the prior ends.
        const bufferB = !options.interrupt && useBufferB
        useBufferB = !bufferB
        const audio = bufferB ? ensurePlaybackAudioB() : ensurePlaybackAudio()
        // Stop the other buffer so we never overlap two voices.
        try {
          const other = bufferB ? sharedAudio : sharedAudioB
          other?.pause()
        } catch {
          // ignore
        }
        await playBlobOnElement(audio, blob, bufferB)
      } finally {
        if (token === generation) speaking = false
      }
    },
    stop() {
      generation += 1
      speaking = false
      useBufferB = false
      prefetchCache.clear()
      try {
        sharedAudio?.pause()
        sharedAudioB?.pause()
      } catch {
        // ignore
      }
      // Critical: settle hung speak() so hands-free resume can run after interrupt.
      activePlayFinish?.()
      activePlayFinish = null
      revokeActiveUrl()
      revokeActiveUrlB()
    },
    isSpeaking() {
      return speaking
    },
  }
}
