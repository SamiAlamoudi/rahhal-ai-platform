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
/** Primed during user gesture — reused by Realtime WebRTC remote playback. */
let primedRemoteAudio: HTMLAudioElement | null = null
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
    // Publish for session diagnostics (suspended vs running).
    ;(window as Window & { __bilamoAudioCtx?: AudioContext }).__bilamoAudioCtx = audioContext
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

/** Public resume for realtime play path — must NOT wipe remote srcObject. */
export async function resumeSharedAudioContext(): Promise<void> {
  await resumeAudioContext()
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
/**
 * Safari autoplay is often per-element. Warm the *actual* playback nodes
 * (not only a throwaway element), or later TTS play() stays NotAllowed.
 */
async function primeElementForSafari(el: HTMLAudioElement): Promise<void> {
  // CRITICAL (iPhone Safari): setting el.src clears MediaStream srcObject.
  // Never wipe a live remote WebRTC stream during unlock / visibility resume.
  const liveStream = el.srcObject
  if (liveStream) {
    el.muted = false
    el.volume = 1
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    // Soft warm only — do not replace src/srcObject.
    await el.play().catch(() => undefined)
    return
  }

  const prevSrc = el.getAttribute('src') || el.src || ''
  const prevMuted = el.muted
  const prevVolume = el.volume
  try {
    el.muted = false
    el.volume = 1
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    el.src = SILENT_WAV
    await el.play().catch(() => undefined)
    el.pause()
    try {
      el.currentTime = 0
    } catch {
      // ignore
    }
  } finally {
    // Never restore a revoked blob: URL — that poisons turn-2+ playback.
    // data: silent WAV and empty src are fine to clear.
    const restoreable =
      Boolean(prevSrc)
      && !prevSrc.startsWith('data:')
      && !prevSrc.startsWith('blob:')
    if (restoreable) {
      try {
        el.src = prevSrc
      } catch {
        el.removeAttribute('src')
      }
    } else {
      try {
        el.removeAttribute('src')
      } catch {
        /* ignore */
      }
    }
    el.muted = prevMuted
    el.volume = prevVolume
  }
}

export async function unlockAudioPlayback(): Promise<void> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return

  // Already unlocked under a prior user gesture — do NOT re-prime with silent WAV.
  // Re-priming outside a gesture (auto-relisten → speak) poisons Safari sticky unlock
  // and makes turn 2+ classic TTS silent while turn 1 still worked.
  if (unlocked) {
    await resumeAudioContext()
    preconnectOpenAiTtsRoute()
    return
  }

  await resumeAudioContext()
  preconnectOpenAiTtsRoute()

  // Ensure playback nodes exist in the DOM under the gesture stack and prime them.
  // Safari autoplay unlock is per-element — warming only a throwaway node left TTS silent.
  try {
    const a = ensurePlaybackAudio()
    const b = ensurePlaybackAudioB()
    const remote = obtainPrimedRemoteAudioElement()
    a.muted = false
    a.volume = 1
    b.muted = false
    b.volume = 1
    remote.muted = false
    remote.volume = 1
    remote.setAttribute('playsinline', 'true')
    remote.setAttribute('webkit-playsinline', 'true')
    await primeElementForSafari(a)
    await primeElementForSafari(b)
    // Prime remote only when it has no live stream (srcObject-safe).
    await primeElementForSafari(remote)
  } catch {
    // ignore
  }

  // Warm element retained for legacy unlock path.
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

  // Persist unlock across visibility / bfcache returns.
  try {
    if (typeof document !== 'undefined' && !(document as Document & { __bilamoAudioUnlockBound?: boolean }).__bilamoAudioUnlockBound) {
      ;(document as Document & { __bilamoAudioUnlockBound?: boolean }).__bilamoAudioUnlockBound = true
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && unlocked) {
          void resumeAudioContext().catch(() => undefined)
        }
      })
      window.addEventListener('pageshow', () => {
        if (unlocked) void resumeAudioContext().catch(() => undefined)
      })
    }
  } catch {
    // ignore
  }
}

/** Expose AudioContext state for diagnostics (never secrets). */
export function getSharedAudioContextState(): string | null {
  return audioContext?.state ?? null
}

/**
 * Realtime remote playback element — created/primed inside unlockAudioPlayback
 * so later async connect() does not invent a brand-new locked element.
 */
export function obtainPrimedRemoteAudioElement(): HTMLAudioElement {
  // Prefer document.createElement so Vitest/jsdom (no Audio ctor) can still boot WebRTC sessions.
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Audio playback is only available in the browser.')
  }
  if (!primedRemoteAudio) {
    primedRemoteAudio = createHiddenAudio('remote-webrtc')
  } else if (!primedRemoteAudio.isConnected) {
    document.body.appendChild(primedRemoteAudio)
  }
  primedRemoteAudio.autoplay = true
  primedRemoteAudio.muted = false
  primedRemoteAudio.volume = 1
  return primedRemoteAudio
}

/** Classic TTS playback element — primed during unlock for Safari autoplay. */
export function obtainPrimedTtsPlaybackElement(): HTMLAudioElement {
  const el = ensurePlaybackAudio()
  el.muted = false
  el.volume = 1
  return el
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
      try {
        const { noteVoiceLifecycleStage } = await import('../../bilamo/voice/voiceHttpTrace')
        noteVoiceLifecycleStage('CLASSIC_TTS_REQUESTED')
      } catch {
        /* ignore */
      }
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
        const mime = blob.type || openaiRes.headers.get('content-type') || request.format
        try {
          const { noteVoiceHttpResult, noteVoiceLifecycleStage } = await import(
            '../../bilamo/voice/voiceHttpTrace'
          )
          noteVoiceHttpResult({
            route: '/api/openai/tts',
            status: openaiRes.status,
            kind: 'tts',
            bytes: blob.size,
            mime,
          })
          noteVoiceLifecycleStage('CLASSIC_TTS_HTTP_OK')
          noteVoiceLifecycleStage('TTS_HTTP_STATUS', { status: openaiRes.status })
          noteVoiceLifecycleStage('TTS_BYTES', {
            bytes: Math.min(blob.size, 9_999_999),
          })
        } catch {
          /* ignore */
        }
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

function clearElementSrcSoft(audio: HTMLAudioElement): void {
  try {
    audio.pause()
  } catch {
    /* ignore */
  }
  try {
    audio.removeAttribute('src')
  } catch {
    /* ignore */
  }
  // Do NOT call load() — Safari drops sticky unlock after load().
}

function playBlobOnElement(
  audio: HTMLAudioElement,
  blob: Blob,
  useB: boolean,
  onPlaybackStart?: () => void,
  onObjectUrlAssigned?: (objectUrl: string) => void,
): Promise<void> {
  // Per-turn: soft-reset persistent element, then assign THIS turn's object URL only.
  try {
    audio.pause()
  } catch {
    /* ignore */
  }
  if (useB) revokeActiveUrlB()
  else revokeActiveUrl()
  const objectUrl = URL.createObjectURL(blob)
  if (useB) activeObjectUrlB = objectUrl
  else activeObjectUrl = objectUrl
  audio.src = objectUrl
  try {
    audio.currentTime = 0
  } catch {
    /* ignore */
  }
  audio.muted = false
  audio.volume = 1
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  onObjectUrlAssigned?.(objectUrl)

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
      audio.ontimeupdate = null
      if (err) {
        if (useB) revokeActiveUrlB()
        else revokeActiveUrl()
        clearElementSrcSoft(audio)
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
    audio.ontimeupdate = () => {
      // Safari sometimes skips 'playing' — currentTime progression is audible proof.
      if (playbackStarted || audio.currentTime <= 0.01) return
      playbackStarted = true
      onPlaybackStart?.()
    }
    audio.onended = () => {
      if (!playbackStarted) {
        // Extremely short clips may end before 'playing' fires — treat ended as audible.
        playbackStarted = true
        onPlaybackStart?.()
      }
      // Revoke ONLY this turn's object URL after playback actually finished.
      if (useB) revokeActiveUrlB()
      else revokeActiveUrl()
      clearElementSrcSoft(audio)
      finish()
    }
    audio.onerror = () => finish(new Error('تعذر تشغيل الصوت'))

    const attemptPlay = () => {
      if (settled) return
      const playAttempt = audio.play()
      if (playAttempt && typeof playAttempt.then === 'function') {
        playAttempt.then(() => {
          // Do NOT treat play() resolve alone as audible start (Safari silent autoplay).
          // Wait briefly for playing/timeupdate; otherwise fail so classic recovery can run.
          window.setTimeout(() => {
            if (settled || playbackStarted) return
            finish(new Error('تعذر تشغيل الصوت — لم يبدأ التشغيل الفعلي'))
          }, 1200)
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
        await playBlobOnElement(
          audio,
          blob,
          bufferB,
          () => options.onAudioPlaybackStart?.(),
          () => options.onObjectUrlAssigned?.(),
        )
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
      // Soft-clear persistent elements — keep them alive for Safari unlock.
      if (sharedAudio) clearElementSrcSoft(sharedAudio)
      if (sharedAudioB) clearElementSrcSoft(sharedAudioB)
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

/** @internal Vitest helper — reset persistent element + unlock latch between tests. */
export function __resetAudioElementTtsForTests(): void {
  unlocked = false
  preconnected = false
  useBufferB = false
  activePlayFinish = null
  prefetchCache.clear()
  try {
    sharedAudio?.pause()
    sharedAudioB?.pause()
    unlockWarmAudio?.pause()
    primedRemoteAudio?.pause()
  } catch {
    /* ignore */
  }
  revokeActiveUrl()
  revokeActiveUrlB()
  if (sharedAudio?.parentNode) sharedAudio.parentNode.removeChild(sharedAudio)
  if (sharedAudioB?.parentNode) sharedAudioB.parentNode.removeChild(sharedAudioB)
  if (primedRemoteAudio?.parentNode) primedRemoteAudio.parentNode.removeChild(primedRemoteAudio)
  sharedAudio = null
  sharedAudioB = null
  unlockWarmAudio = null
  primedRemoteAudio = null
  try {
    void audioContext?.close()
  } catch {
    /* ignore */
  }
  audioContext = null
}
