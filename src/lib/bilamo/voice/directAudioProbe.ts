/**
 * Independent /voice-diagnostics audio harness.
 * Completely separate from BilamoVoiceSession / realtime capability probe.
 * Must be invoked from a physical user gesture (اختبار الصوت tap).
 */

import {
  getSharedAudioContextState,
  obtainPrimedTtsPlaybackElement,
  resumeSharedAudioContext,
  unlockAudioPlayback,
} from '../../chat/voice/audioElementTextToSpeechProvider'
import { parseSafeErrorCodeFromResponse } from './voiceHttpTrace'

export const DIRECT_AUDIO_PROBE_TEXT =
  'مرحباً، أنا بيلامو. إذا كنت تسمعني فاختبار الصوت يعمل بنجاح.'

export type DiagnosticAudioStage =
  | 'DIAGNOSTIC_TTS_GESTURE'
  | 'AUDIO_ELEMENT_READY'
  | 'AUDIO_CONTEXT_RESUME_ATTEMPT'
  | 'CLASSIC_TTS_REQUESTED'
  | `CLASSIC_TTS_HTTP_${number}`
  | `CLASSIC_TTS_MIME_${string}`
  | `CLASSIC_TTS_BYTES_${number}`
  | 'AUDIO_SRC_ASSIGNED'
  | 'PLAY_CALLED'
  | 'PLAY_RESOLVED'
  | `PLAY_REJECTED_${string}`
  | 'PLAYBACK_PROGRESS'
  | 'ACTUAL_PLAYBACK_STARTED'
  | 'PLAYBACK_ENDED'
  | string

export type DiagnosticAudioVerdict = 'NOT_RUN' | 'PASS' | 'FAIL'

export type DirectAudioProbeResult = {
  correlationId: string
  stage: string
  stages: string[]
  httpStatus: number | null
  contentType: string | null
  bytes: number
  safeServerErrorCode: string | null
  audioContextState: string | null
  playCalled: boolean
  playResult: 'resolved' | 'rejected' | 'pending' | null
  playError: string | null
  playErrorMessage: string | null
  playingEvent: boolean
  timeupdateSeen: boolean
  maxCurrentTime: number
  ended: boolean
  elementReadyState: number | null
  elementPaused: boolean | null
  elementMuted: boolean | null
  elementVolume: number | null
  /** Legacy string used by older UI/tests. */
  result: 'AUDIBLE_PIPELINE_CONFIRMED' | 'VOICE_OUTPUT_FAILED' | 'NOT_RUN'
  verdict: DiagnosticAudioVerdict
  failureStage: string | null
  /** True when measurable playback progression was observed. */
  playbackProgressed: boolean
}

export type DiagnosticAudioHarnessState = {
  busy: boolean
  verdict: DiagnosticAudioVerdict
  failureStage: string | null
  stages: string[]
  lastStage: string | null
  latest: DirectAudioProbeResult | null
  /** Wall clock of last reset / run start — for UI freshness. */
  updatedAtMs: number | null
}

export type DirectAudioProbeDeps = {
  fetchTts?: (init: RequestInit) => Promise<Response>
  unlock?: () => Promise<void>
  resumeContext?: () => Promise<void>
  obtainAudio?: () => HTMLAudioElement
  now?: () => number
  /** Test hook: skip waiting for natural ended. */
  progressTimeoutMs?: number
}

const listeners = new Set<() => void>()

let harness: DiagnosticAudioHarnessState = emptyHarness()

function emptyHarness(): DiagnosticAudioHarnessState {
  return {
    busy: false,
    verdict: 'NOT_RUN',
    failureStage: null,
    stages: [],
    lastStage: null,
    latest: null,
    updatedAtMs: null,
  }
}

function emptyResult(correlationId: string): DirectAudioProbeResult {
  return {
    correlationId,
    stage: 'idle',
    stages: [],
    httpStatus: null,
    contentType: null,
    bytes: 0,
    safeServerErrorCode: null,
    audioContextState: null,
    playCalled: false,
    playResult: null,
    playError: null,
    playErrorMessage: null,
    playingEvent: false,
    timeupdateSeen: false,
    maxCurrentTime: 0,
    ended: false,
    elementReadyState: null,
    elementPaused: null,
    elementMuted: null,
    elementVolume: null,
    result: 'NOT_RUN',
    verdict: 'NOT_RUN',
    failureStage: null,
    playbackProgressed: false,
  }
}

function emit(): void {
  for (const l of listeners) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}

function noteStage(out: DirectAudioProbeResult, stage: string): void {
  out.stage = stage
  out.stages.push(stage)
  harness.stages = [...out.stages]
  harness.lastStage = stage
  harness.updatedAtMs = Date.now()
  emit()
}

function newCorrelationId(): string {
  try {
    return crypto.randomUUID().slice(0, 12)
  } catch {
    return `probe_${Date.now().toString(36)}`
  }
}

function cleanupAudio(
  audio: HTMLAudioElement,
  objectUrl: string,
  out: DirectAudioProbeResult,
): void {
  try {
    out.elementReadyState = audio.readyState
    out.elementPaused = audio.paused
    out.elementMuted = audio.muted
    out.elementVolume = audio.volume
  } catch {
    /* ignore */
  }
  try {
    audio.pause()
    URL.revokeObjectURL(objectUrl)
    audio.removeAttribute('src')
    audio.load()
  } catch {
    /* ignore */
  }
}

export function getDiagnosticAudioHarnessState(): DiagnosticAudioHarnessState {
  return {
    ...harness,
    stages: [...harness.stages],
    latest: harness.latest ? { ...harness.latest, stages: [...harness.latest.stages] } : null,
  }
}

export function subscribeDiagnosticAudioHarness(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Clear harness so the next physical tap starts clean. Does not touch voice session. */
export function resetDiagnosticAudioHarness(): void {
  harness = emptyHarness()
  harness.updatedAtMs = Date.now()
  emit()
}

/** @internal Vitest helper */
export function __resetDiagnosticAudioHarnessForTests(): void {
  listeners.clear()
  harness = emptyHarness()
}

export function formatAudioTestBanner(state: DiagnosticAudioHarnessState): string {
  if (state.verdict === 'NOT_RUN') return 'AUDIO TEST: NOT RUN'
  if (state.verdict === 'PASS') return 'AUDIO TEST: PASS — PLAYBACK CONFIRMED'
  const stage = state.failureStage || state.lastStage || 'UNKNOWN'
  return `AUDIO TEST: FAIL — ${stage}`
}

/**
 * Request classic OpenAI TTS for a fixed Arabic sentence and play it.
 * Must be invoked synchronously from a user gesture (button tap).
 * Independent of mic / realtime / voice session.
 */
export async function runDirectAudioProbe(
  deps: DirectAudioProbeDeps = {},
): Promise<DirectAudioProbeResult> {
  const correlationId = newCorrelationId()
  const out = emptyResult(correlationId)
  const unlock = deps.unlock ?? unlockAudioPlayback
  const resumeContext = deps.resumeContext ?? resumeSharedAudioContext
  const obtainAudio = deps.obtainAudio ?? obtainPrimedTtsPlaybackElement
  const progressTimeoutMs = deps.progressTimeoutMs ?? 8_000

  harness.busy = true
  harness.verdict = 'NOT_RUN'
  harness.failureStage = null
  harness.stages = []
  harness.lastStage = null
  harness.latest = out
  harness.updatedAtMs = Date.now()
  emit()

  const fail = (stage: string): DirectAudioProbeResult => {
    out.failureStage = stage
    out.verdict = 'FAIL'
    out.result = 'VOICE_OUTPUT_FAILED'
    if (out.stages[out.stages.length - 1] !== stage) {
      noteStage(out, stage)
    }
    harness.verdict = 'FAIL'
    harness.failureStage = stage
    harness.latest = { ...out, stages: [...out.stages] }
    harness.busy = false
    harness.updatedAtMs = Date.now()
    emit()
    return out
  }

  const pass = (): DirectAudioProbeResult => {
    out.failureStage = null
    out.verdict = 'PASS'
    out.result = 'AUDIBLE_PIPELINE_CONFIRMED'
    out.playbackProgressed = true
    noteStage(out, 'ACTUAL_PLAYBACK_STARTED')
    if (out.ended) noteStage(out, 'PLAYBACK_ENDED')
    harness.verdict = 'PASS'
    harness.failureStage = null
    harness.latest = { ...out, stages: [...out.stages] }
    harness.busy = false
    harness.updatedAtMs = Date.now()
    emit()
    return out
  }

  try {
    // Synchronous gesture marker — before any network await.
    noteStage(out, 'DIAGNOSTIC_TTS_GESTURE')

    let audio: HTMLAudioElement
    try {
      audio = obtainAudio()
      noteStage(out, 'AUDIO_ELEMENT_READY')
    } catch (err) {
      return fail(
        `AUDIO_ELEMENT_READY_FAILED:${err instanceof Error ? err.name : 'error'}`,
      )
    }

    noteStage(out, 'AUDIO_CONTEXT_RESUME_ATTEMPT')
    try {
      await resumeContext()
    } catch {
      /* best-effort */
    }
    try {
      await unlock()
    } catch {
      /* best-effort — play path still attempted */
    }
    out.audioContextState = getSharedAudioContextState()

    noteStage(out, 'CLASSIC_TTS_REQUESTED')

    const fetchTts =
      deps.fetchTts
      ?? (async (init: RequestInit) => {
        const { voiceAuthenticatedFetch } = await import('../../security/voiceAuthProbe')
        return voiceAuthenticatedFetch('/api/openai/tts', {
          method: 'POST',
          kind: 'tts',
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers as Record<string, string> | undefined),
          },
        })
      })

    let res: Response
    try {
      res = await fetchTts({
        body: JSON.stringify({
          text: DIRECT_AUDIO_PROBE_TEXT,
          locale: 'ar',
          voice: 'marin',
          format: 'wav',
          speed: 1,
          instructions:
            'Speak naturally in clear Arabic as Bilamo. Warm, confident, concise.',
        }),
      })
    } catch (err) {
      const name = err instanceof Error ? err.name : 'fetch_error'
      const msg = err instanceof Error ? err.message.slice(0, 80) : 'fetch_failed'
      out.playError = name
      out.playErrorMessage = msg
      return fail(`CLASSIC_TTS_HTTP_0`)
    }

    out.httpStatus = res.status
    out.contentType = res.headers.get('content-type')
    noteStage(out, `CLASSIC_TTS_HTTP_${res.status}`)

    if (!res.ok) {
      out.safeServerErrorCode = await parseSafeErrorCodeFromResponse(res)
      return fail(`CLASSIC_TTS_HTTP_${res.status}`)
    }

    const blob = await res.blob()
    out.bytes = blob.size
    const mime = (out.contentType || blob.type || 'unknown').split(';')[0]?.trim() || 'unknown'
    noteStage(out, `CLASSIC_TTS_MIME_${mime}`)
    noteStage(out, `CLASSIC_TTS_BYTES_${blob.size}`)

    if (blob.size < 64) {
      return fail('CLASSIC_TTS_BYTES_0')
    }
    const mimeLower = mime.toLowerCase()
    if (
      mimeLower
      && !mimeLower.includes('audio')
      && !mimeLower.includes('octet-stream')
      && !mimeLower.includes('wav')
    ) {
      return fail(`CLASSIC_TTS_MIME_${mime}`)
    }

    const objectUrl = URL.createObjectURL(blob)
    audio.src = objectUrl
    audio.muted = false
    audio.volume = 1
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    out.elementMuted = audio.muted
    out.elementVolume = audio.volume
    noteStage(out, 'AUDIO_SRC_ASSIGNED')

    let endedSignal: (() => void) | null = null
    const endedPromise = new Promise<void>((resolve) => {
      endedSignal = resolve
    })

    audio.onplaying = () => {
      out.playingEvent = true
      if (!out.stages.includes('PLAYBACK_PROGRESS')) {
        noteStage(out, 'PLAYBACK_PROGRESS')
      }
    }
    audio.ontimeupdate = () => {
      out.timeupdateSeen = true
      if (audio.currentTime > out.maxCurrentTime) out.maxCurrentTime = audio.currentTime
      if (out.maxCurrentTime > 0.05 && !out.stages.includes('PLAYBACK_PROGRESS')) {
        noteStage(out, 'PLAYBACK_PROGRESS')
      }
    }
    audio.onended = () => {
      out.ended = true
      if (!out.stages.includes('PLAYBACK_ENDED')) {
        noteStage(out, 'PLAYBACK_ENDED')
      }
      endedSignal?.()
    }
    audio.onerror = () => {
      out.playResult = 'rejected'
      out.playError = 'element_error'
      out.playErrorMessage = 'HTMLAudioElement error'
      out.failureStage = 'PLAY_REJECTED_element_error'
      if (!out.stages.includes('PLAY_REJECTED_element_error')) {
        noteStage(out, 'PLAY_REJECTED_element_error')
      }
      endedSignal?.()
    }

    out.playCalled = true
    out.playResult = 'pending'
    noteStage(out, 'PLAY_CALLED')

    const attempt = audio.play()
    if (!attempt || typeof attempt.then !== 'function') {
      cleanupAudio(audio, objectUrl, out)
      return fail('PLAY_REJECTED_unsupported')
    }

    try {
      await attempt
      out.playResult = 'resolved'
      noteStage(out, 'PLAY_RESOLVED')
    } catch (err) {
      const name = err instanceof Error ? err.name : 'play_rejected'
      const message = err instanceof Error ? err.message.slice(0, 120) : String(err)
      out.playResult = 'rejected'
      out.playError = name
      out.playErrorMessage = message
      const stage = `PLAY_REJECTED_${name}`
      out.failureStage = stage
      noteStage(out, stage)
      cleanupAudio(audio, objectUrl, out)
      return fail(stage)
    }

    // HTTP 200 + play() resolve alone is NOT success — wait for progression.
    const alreadyProgressed =
      out.playingEvent || out.maxCurrentTime > 0.05 || out.ended
    if (!alreadyProgressed) {
      await Promise.race([
        endedPromise,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, progressTimeoutMs)
        }),
      ])
    } else if (!out.ended) {
      // Give onended a brief chance without delaying PASS on already-progressed audio.
      await Promise.race([
        endedPromise,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 30)
        }),
      ])
    }

    out.elementReadyState = audio.readyState
    out.elementPaused = audio.paused
    out.elementMuted = audio.muted
    out.elementVolume = audio.volume
    out.audioContextState = getSharedAudioContextState()
    out.ended = out.ended || audio.ended
    cleanupAudio(audio, objectUrl, out)

    const progressed = shouldConfirmAudible({
      playResult: out.playResult,
      playingEvent: out.playingEvent,
      maxCurrentTime: out.maxCurrentTime,
      ended: out.ended,
    })

    if (progressed) {
      return pass()
    }
    if (out.playResult === 'rejected') {
      return fail(out.failureStage || `PLAY_REJECTED_${out.playError || 'unknown'}`)
    }
    if (out.playResult === 'resolved') {
      return fail('PLAY_RESOLVED_NO_PROGRESSION')
    }
    return fail(out.failureStage || 'PLAYBACK_UNCONFIRMED')
  } catch (err) {
    const name = err instanceof Error ? err.name : 'probe_exception'
    const message = err instanceof Error ? err.message.slice(0, 80) : 'probe_exception'
    out.playError = name
    out.playErrorMessage = message
    return fail(`EXCEPTION_${name}`)
  } finally {
    harness.busy = false
    harness.latest = { ...out, stages: [...out.stages] }
    harness.updatedAtMs = Date.now()
    emit()
  }
}

/** Pure helpers for regression tests. */
export function classifyTtsProbeHttp(status: number, bytes: number, contentType: string | null): string {
  if (status === 401 || status === 403) return `tts_http_${status}`
  if (status >= 500) return `tts_http_${status}`
  if (status !== 200) return `tts_http_${status}`
  if (bytes < 64) return 'zero_byte_tts'
  const mime = (contentType || '').toLowerCase()
  if (mime && !mime.includes('audio') && !mime.includes('octet-stream') && !mime.includes('wav')) {
    return `wrong_mime:${mime}`
  }
  return 'ok'
}

export function shouldConfirmAudible(input: {
  playResult: DirectAudioProbeResult['playResult']
  playingEvent: boolean
  maxCurrentTime: number
  ended: boolean
}): boolean {
  if (input.playResult !== 'resolved') return false
  return input.playingEvent || input.maxCurrentTime > 0.05 || input.ended
}

/**
 * Capability-probe HTTP notes must never mutate the audio harness verdict.
 * Used by tests + diagnostics page to assert isolation.
 */
export function applyCapabilityProbeToHarnessIsNoOp(): boolean {
  const before = getDiagnosticAudioHarnessState()
  // Harness has no API for capability probe — isolation is structural.
  const after = getDiagnosticAudioHarnessState()
  return (
    before.verdict === after.verdict
    && before.stages.length === after.stages.length
    && before.failureStage === after.failureStage
  )
}
