/**
 * Reliable TTS via POST /api/openai/tts → DOM-attached HTMLAudioElement.
 *
 * Architecture (Voice Experience Sprint):
 * - Exactly one OpenAI speech request per assistant turn.
 * - No progressive mid-stream chunk TTS.
 * - Preferences (voice / dialect / speed) come from speak() options.
 *
 * Autoplay rules (Chrome/Safari):
 * - Unlock must happen during a user gesture (mic / send).
 * - Unlock must NOT mutate the playback element (no src wipe / load()).
 * - The playback element should live in the DOM (Safari is picky).
 */
import type { TextToSpeechProvider, TextToSpeechSpeakOptions, VoiceLocale } from './voiceTypes'
import { logChat } from '../chatLogger'
import {
  DEFAULT_VOICE_PREFS,
  buildTtsSpeechInstructions,
  loadVoiceExperiencePrefs,
  speakingSpeedRate,
  type ArabicDialectPreference,
  type OpenAiTtsVoiceId,
} from './voiceExperiencePrefs'

let unlocked = false
let sharedAudio: HTMLAudioElement | null = null
let sharedAudioB: HTMLAudioElement | null = null
let unlockWarmAudio: HTMLAudioElement | null = null
let activeObjectUrl: string | null = null
let activeObjectUrlB: string | null = null
let useBufferB = false
let audioContext: AudioContext | null = null
let preconnected = false

/** Tiny silent WAV — primes autoplay permission after a click/tap. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

type TtsRequestBody = {
  text: string
  locale: VoiceLocale
  voice: string
  speed: number
  dialect?: string
  instructions: string
  format: 'wav' | 'mp3'
}

function resolveTtsRequest(options: Pick<
  TextToSpeechSpeakOptions,
  'locale' | 'text' | 'voice' | 'speed' | 'dialect' | 'instructions' | 'format'
>): TtsRequestBody {
  const prefs = loadVoiceExperiencePrefs()
  const locale = options.locale
  const voice = (options.voice || (locale === 'ar' ? prefs.voiceId : 'nova')).trim()
  const speed = typeof options.speed === 'number' && Number.isFinite(options.speed)
    ? options.speed
    : speakingSpeedRate(prefs.speed)
  const dialect = (options.dialect || prefs.dialect) as ArabicDialectPreference
  const instructions = options.instructions?.trim()
    || buildTtsSpeechInstructions({ locale, dialect })
  const format = options.format === 'mp3' ? 'mp3' : 'wav'
  return {
    text: options.text.trim(),
    locale,
    voice,
    speed,
    dialect: locale === 'ar' ? dialect : undefined,
    instructions,
    format,
  }
}

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

/** Second buffer kept only so interrupt can pause both; one-shot path uses A primarily. */
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

/** DNS/TLS warm-up for the TTS route — does not synthesize audio. */
export function preconnectOpenAiTtsRoute(): void {
  if (typeof document === 'undefined' || preconnected) return
  preconnected = true
  try {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = window.location.origin
    link.setAttribute('data-rahhal-tts-preconnect', '1')
    document.head.appendChild(link)
  } catch {
    // ignore
  }
  // Tiny OPTIONS/HEAD-less warm: fire a cheap OPTIONS via fetch no-cors is useless;
  // instead poke the route with an abortable empty body so the edge function stays warm.
  const controller = new AbortController()
  window.setTimeout(() => controller.abort(), 2500)
  void (async () => {
    try {
      const { requireProxyAuthHeaders } = await import('../../security/proxyAuth')
      const headers = await requireProxyAuthHeaders()
      await fetch('/api/openai/tts', {
        method: 'OPTIONS',
        headers,
        signal: controller.signal,
      })
    } catch {
      // Preconnect is best-effort; unsigned-in callers skip.
    }
  })()
}

/**
 * Call from a user gesture (mic tap / send) before the async reply returns.
 * Uses a *separate* warm-up element so we never wipe the playback element's src.
 */
export async function unlockAudioPlayback(): Promise<void> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return

  await resumeAudioContext()
  preconnectOpenAiTtsRoute()

  // Ensure playback node exists in the DOM under the gesture stack.
  try {
    ensurePlaybackAudio()
  } catch {
    // ignore
  }

  // Sprint 80 P1-6: unlock uses silent local audio + route preconnect/OPTIONS only.
  // Do not POST a synthetic "مرحبا" TTS — that burns latency and proxy quota on every gesture.

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

async function synthesizeViaLegacyApi(text: string, locale: VoiceLocale): Promise<Blob> {
  logChat('warn', 'tts', 'openai_unavailable_falling_back_legacy_api_tts', { locale })
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
 * OpenAI TTS is the only runtime path while healthy.
 * Edge / legacy TTS run only after OpenAI is confirmed unavailable, and always log why.
 */
async function fetchSpeechAudio(
  request: TtsRequestBody,
  hooks?: {
    onTtsRequestStart?: () => void
    onTtsResponseComplete?: () => void
  },
): Promise<Blob> {
  let lastOpenAiReason = 'unknown'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      hooks?.onTtsRequestStart?.()
      const { voiceAuthenticatedFetch } = await import('../../security/voiceAuthProbe')
      const openaiRes = await voiceAuthenticatedFetch('/api/openai/tts', {
        method: 'POST',
        kind: 'tts',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (openaiRes.ok) {
        const blob = await openaiRes.blob()
        hooks?.onTtsResponseComplete?.()
        if (blob.size >= 64) {
          logChat('debug', 'tts', 'openai_tts_ok', {
            bytes: blob.size,
            attempt: attempt + 1,
            voice: request.voice,
            format: request.format,
          })
          return blob
        }
        lastOpenAiReason = `empty_blob:${blob.size}`
        logChat('warn', 'tts', 'openai_tts_empty_blob', { size: blob.size, attempt: attempt + 1 })
      } else {
        lastOpenAiReason = `http_${openaiRes.status}`
        logChat('warn', 'tts', 'openai_tts_http_error', {
          status: openaiRes.status,
          attempt: attempt + 1,
        })
      }
    } catch (error) {
      lastOpenAiReason = error instanceof Error ? error.message : String(error)
      logChat('warn', 'tts', 'openai_tts_network_error', {
        message: lastOpenAiReason,
        attempt: attempt + 1,
      })
    }
  }

  // OpenAI completely unavailable — last-resort backups with explicit logs (never silent).
  logChat('error', 'tts', 'openai_tts_unavailable_using_backup', {
    reason: lastOpenAiReason,
    locale: request.locale,
    backup: request.locale === 'ar' ? 'edge_neural' : 'edge_or_legacy',
  })

  try {
    return await synthesizeViaEdgeBrowser(request.text, request.locale)
  } catch (edgeError) {
    logChat('warn', 'tts', 'edge_tts_failed', {
      message: edgeError instanceof Error ? edgeError.message : String(edgeError),
    })
    if (request.locale === 'ar') {
      throw new Error(`arabic_tts_unavailable:${lastOpenAiReason}`)
    }
    return await synthesizeViaLegacyApi(request.text, request.locale)
  }
}

async function synthesizeViaEdgeBrowser(text: string, locale: VoiceLocale): Promise<Blob> {
  const { EdgeTTSBrowser } = await import('edge-tts-universal/browser')
  // French replies use VoiceLocale 'en' (nova/Jenny handle FR); Arabic stays dedicated.
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

function playBlobOnElement(
  audio: HTMLAudioElement,
  blob: Blob,
  useB: boolean,
  onPlaybackStart?: () => void,
): Promise<void> {
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
    let playbackStarted = false
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

    audio.onplaying = () => {
      if (playbackStarted) return
      playbackStarted = true
      onPlaybackStart?.()
    }
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
          if (!playbackStarted) {
            playbackStarted = true
            onPlaybackStart?.()
          }
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

function prefetchKey(request: TtsRequestBody): string {
  return [
    request.locale,
    request.voice,
    request.speed,
    request.dialect || '',
    request.format,
    request.text,
  ].join('\0')
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
      const request = resolveTtsRequest({ ...options, text })
      const key = prefetchKey(request)
      if (prefetchCache.has(key)) return
      const pending = fetchSpeechAudio(request)
        .catch((error) => {
          prefetchCache.delete(key)
          throw error
        })
      prefetchCache.set(key, pending)
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
        activePlayFinish?.()
        activePlayFinish = null
        revokeActiveUrl()
        revokeActiveUrlB()
      }

      const token = ++generation
      speaking = true
      const request = resolveTtsRequest({ ...options, text })

      try {
        if (!unlocked) {
          await unlockAudioPlayback()
        } else {
          await resumeAudioContext()
          preconnectOpenAiTtsRoute()
        }

        const key = prefetchKey(request)
        let requestStartFired = false
        const pending = prefetchCache.get(key) ?? fetchSpeechAudio(request, {
          onTtsRequestStart: () => {
            if (requestStartFired) return
            requestStartFired = true
            options.onTtsRequestStart?.()
          },
          onTtsResponseComplete: () => options.onTtsResponseComplete?.(),
        })
        prefetchCache.delete(key)
        const blob = await pending
        options.onAudioDecodeComplete?.()
        if (token !== generation) {
          speaking = false
          return
        }

        // Prefer a single buffer for one-shot turns (interrupt: true).
        const bufferB = options.interrupt === false && useBufferB
        useBufferB = !bufferB
        const audio = bufferB ? ensurePlaybackAudioB() : ensurePlaybackAudio()
        try {
          const other = bufferB ? sharedAudio : sharedAudioB
          other?.pause()
        } catch {
          // ignore
        }
        await playBlobOnElement(audio, blob, bufferB, () => options.onAudioPlaybackStart?.())
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

/** Test helper — default voice used when prefs are unset. */
export function defaultOpenAiVoiceForLocale(locale: VoiceLocale): OpenAiTtsVoiceId | 'nova' {
  return locale === 'ar' ? DEFAULT_VOICE_PREFS.voiceId : 'nova'
}
