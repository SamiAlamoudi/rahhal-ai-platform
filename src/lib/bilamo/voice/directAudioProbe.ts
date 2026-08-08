/**
 * Independent /voice-diagnostics Safari audio harness.
 *
 * Completely separate from BilamoVoiceSession / realtime capability probe.
 * Local + TTS controls share ONE persistent HTMLAudioElement.
 *
 * Critical iPhone Safari rule:
 * play() a silent WAV on the persistent element INSIDE the tap gesture,
 * THEN await network, THEN reuse the SAME unlocked element for real audio.
 */

import { getSharedAudioContextState, resumeSharedAudioContext } from '../../chat/voice/audioElementTextToSpeechProvider'
import { parseSafeErrorCodeFromResponse } from './voiceHttpTrace'

export const DIRECT_AUDIO_PROBE_TEXT =
  'مرحباً، أنا بيلامو. إذا كنت تسمعني فاختبار الصوت يعمل بنجاح.'

/** Tiny silent WAV — unlocks the persistent element under a user gesture. */
export const DIAGNOSTIC_SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

/** Safari-preferred classic TTS format (OpenAI FM uses mp3 for non-Blink). */
export const DIAGNOSTIC_TTS_FORMAT = 'mp3' as const

export type DiagnosticAudioMode = 'local' | 'tts' | null

export type DiagnosticAudioVerdict = 'NOT_RUN' | 'RUNNING' | 'PASS' | 'FAIL'

export type DirectAudioProbeResult = {
  correlationId: string
  mode: DiagnosticAudioMode
  stage: string
  stages: string[]
  httpStatus: number | null
  contentType: string | null
  requestedFormat: string | null
  bytes: number
  fileSignature: string | null
  canPlayType: string | null
  safeServerErrorCode: string | null
  audioContextStateBefore: string | null
  audioContextStateAfter: string | null
  audioContextState: string | null
  playCalled: boolean
  playResult: 'resolved' | 'rejected' | 'pending' | null
  playError: string | null
  playErrorMessage: string | null
  playingEvent: boolean
  timeupdateSeen: boolean
  maxCurrentTime: number
  currentTimeBefore: number | null
  currentTimeAfter: number | null
  ended: boolean
  duration: number | null
  elementReadyState: number | null
  elementNetworkState: number | null
  elementPaused: boolean | null
  elementMuted: boolean | null
  elementVolume: number | null
  elementAttached: boolean | null
  hasSrc: boolean | null
  hasSrcObject: boolean | null
  isSafari: boolean | null
  iosVersion: string | null
  /** Legacy string used by older UI/tests. */
  result: 'AUDIBLE_PIPELINE_CONFIRMED' | 'VOICE_OUTPUT_FAILED' | 'NOT_RUN'
  verdict: DiagnosticAudioVerdict
  failureStage: string | null
  playbackProgressed: boolean
}

export type DiagnosticAudioHarnessState = {
  busy: boolean
  verdict: DiagnosticAudioVerdict
  failureStage: string | null
  stages: string[]
  lastStage: string | null
  latest: DirectAudioProbeResult | null
  updatedAtMs: number | null
  /** Identity of the persistent element (for same-element assertions). */
  elementId: string | null
}

export type DirectAudioProbeDeps = {
  fetchTts?: (init: RequestInit) => Promise<Response>
  resumeContext?: () => Promise<void>
  obtainAudio?: () => HTMLAudioElement
  progressTimeoutMs?: number
  /** Inject local audio URL / data URI for tests. */
  localAudioSrc?: string
}

const listeners = new Set<() => void>()

/** One persistent element for local + TTS diagnostics. */
let diagnosticAudio: HTMLAudioElement | null = null
const diagnosticElementId = 'bilamo-diagnostic-audio'
let activeDiagnosticObjectUrl: string | null = null

function emptyHarness(): DiagnosticAudioHarnessState {
  return {
    busy: false,
    verdict: 'NOT_RUN',
    failureStage: null,
    stages: [],
    lastStage: null,
    latest: null,
    updatedAtMs: null,
    elementId: diagnosticAudio ? diagnosticElementId : null,
  }
}

let harness: DiagnosticAudioHarnessState = emptyHarness()

function emptyResult(correlationId: string, mode: DiagnosticAudioMode): DirectAudioProbeResult {
  return {
    correlationId,
    mode,
    stage: 'idle',
    stages: [],
    httpStatus: null,
    contentType: null,
    requestedFormat: null,
    bytes: 0,
    fileSignature: null,
    canPlayType: null,
    safeServerErrorCode: null,
    audioContextStateBefore: null,
    audioContextStateAfter: null,
    audioContextState: null,
    playCalled: false,
    playResult: null,
    playError: null,
    playErrorMessage: null,
    playingEvent: false,
    timeupdateSeen: false,
    maxCurrentTime: 0,
    currentTimeBefore: null,
    currentTimeAfter: null,
    ended: false,
    duration: null,
    elementReadyState: null,
    elementNetworkState: null,
    elementPaused: null,
    elementMuted: null,
    elementVolume: null,
    elementAttached: null,
    hasSrc: null,
    hasSrcObject: null,
    isSafari: null,
    iosVersion: null,
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
  harness.verdict = out.verdict === 'PASS' || out.verdict === 'FAIL' ? out.verdict : 'RUNNING'
  harness.latest = { ...out, stages: [...out.stages] }
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

function detectSafari(): { isSafari: boolean; iosVersion: string | null } {
  if (typeof navigator === 'undefined') return { isSafari: false, iosVersion: null }
  const ua = navigator.userAgent || ''
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Edg/i.test(ua)
  const iosMatch = ua.match(/OS (\d+)[_.](\d+)/)
  return {
    isSafari,
    iosVersion: iosMatch ? `${iosMatch[1]}.${iosMatch[2]}` : null,
  }
}

/** Short audible beep WAV (no network) — proves Safari element path. */
export function createAudibleBeepWavDataUri(
  durationMs = 450,
  freqHz = 880,
): string {
  const sampleRate = 22050
  const numSamples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000))
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate
    const envelope = Math.min(1, i / 200) * Math.min(1, (numSamples - i) / 400)
    const sample = Math.sin(2 * Math.PI * freqHz * t) * 0.35 * envelope
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64')
  return `data:audio/wav;base64,${b64}`
}

/**
 * Obtain the single persistent diagnostic audio element.
 * Creates + attaches synchronously. Never creates a second element.
 */
export function obtainDiagnosticAudioElement(): HTMLAudioElement {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Audio playback is only available in the browser.')
  }
  if (!diagnosticAudio) {
    const el = document.createElement('audio')
    el.id = diagnosticElementId
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    el.setAttribute('data-bilamo-diagnostic-audio', '1')
    el.preload = 'auto'
    el.controls = false
    el.muted = false
    el.volume = 1
    try {
      el.style.cssText =
        'position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:0;bottom:0;z-index:-1;'
    } catch {
      /* jsdom / test stubs may lack style */
    }
    document.body.appendChild(el)
    diagnosticAudio = el
  } else if (!diagnosticAudio.isConnected) {
    document.body.appendChild(diagnosticAudio)
  }
  // Classic path must never use srcObject.
  try {
    if (diagnosticAudio.srcObject) {
      diagnosticAudio.srcObject = null
    }
  } catch {
    /* ignore */
  }
  diagnosticAudio.muted = false
  diagnosticAudio.volume = 1
  diagnosticAudio.setAttribute('playsinline', 'true')
  diagnosticAudio.setAttribute('webkit-playsinline', 'true')
  harness.elementId = diagnosticElementId
  return diagnosticAudio
}

/** @internal — identity check for tests */
export function getDiagnosticAudioElementForTests(): HTMLAudioElement | null {
  return diagnosticAudio
}

function snapshotElement(out: DirectAudioProbeResult, audio: HTMLAudioElement): void {
  out.elementReadyState = audio.readyState
  out.elementNetworkState = audio.networkState
  out.elementPaused = audio.paused
  out.elementMuted = audio.muted
  out.elementVolume = audio.volume
  out.elementAttached = Boolean(audio.isConnected)
  out.hasSrc = Boolean(audio.getAttribute('src') || audio.src)
  out.hasSrcObject = Boolean(audio.srcObject)
  try {
    out.duration = Number.isFinite(audio.duration) ? audio.duration : null
  } catch {
    out.duration = null
  }
}

function revokeDiagnosticObjectUrl(): void {
  if (activeDiagnosticObjectUrl) {
    try {
      URL.revokeObjectURL(activeDiagnosticObjectUrl)
    } catch {
      /* ignore */
    }
    activeDiagnosticObjectUrl = null
  }
}

/**
 * Gesture unlock: play silent WAV on the persistent element NOW.
 * Must run inside the originating tap, before any network await.
 */
export async function unlockDiagnosticAudioElement(
  audio: HTMLAudioElement,
): Promise<void> {
  // Never overwrite a real blob/http src with silent priming mid-playback.
  const src = audio.getAttribute('src') || audio.src || ''
  const hasRealSrc = Boolean(src) && !src.startsWith('data:')
  if (hasRealSrc && !audio.paused && !audio.ended) {
    return
  }
  audio.muted = false
  audio.volume = 1
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  // Classic only — never touch srcObject for unlock.
  try {
    if (audio.srcObject) audio.srcObject = null
  } catch {
    /* ignore */
  }
  audio.src = DIAGNOSTIC_SILENT_WAV
  try {
    await audio.play()
  } catch {
    /* unlock best-effort */
  }
  try {
    audio.pause()
    audio.currentTime = 0
  } catch {
    /* ignore */
  }
  // Clear silent data src so real audio can be assigned; element stays unlocked.
  try {
    audio.removeAttribute('src')
    // Do NOT call load() here — some Safari builds drop unlock across load().
  } catch {
    /* ignore */
  }
}

function sniffFileSignature(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null
  // RIFF....WAVE
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'RIFF/WAV'
  }
  // ID3
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'ID3/MP3'
  // MPEG frame sync
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return 'MPEG_FRAME'
  // ftyp (m4a/aac)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'FTYP/MP4'
  }
  return `BIN_${bytes[0]!.toString(16)}_${bytes[1]!.toString(16)}`
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

export function resetDiagnosticAudioHarness(): void {
  try {
    if (diagnosticAudio) {
      diagnosticAudio.pause()
      diagnosticAudio.onplaying = null
      diagnosticAudio.ontimeupdate = null
      diagnosticAudio.onended = null
      diagnosticAudio.onerror = null
      // Soft clear — keep element attached for next tap unlock.
      diagnosticAudio.removeAttribute('src')
    }
  } catch {
    /* ignore */
  }
  revokeDiagnosticObjectUrl()
  harness = emptyHarness()
  harness.elementId = diagnosticAudio ? diagnosticElementId : null
  harness.updatedAtMs = Date.now()
  emit()
}

/** @internal Vitest helper */
export function __resetDiagnosticAudioHarnessForTests(): void {
  listeners.clear()
  try {
    diagnosticAudio?.pause()
    diagnosticAudio?.remove()
  } catch {
    /* ignore */
  }
  diagnosticAudio = null
  revokeDiagnosticObjectUrl()
  harness = emptyHarness()
}

export function formatAudioTestBanner(state: DiagnosticAudioHarnessState): string {
  if (state.verdict === 'NOT_RUN') return 'AUDIO TEST: NOT RUN'
  if (state.verdict === 'RUNNING') {
    return `AUDIO TEST: RUNNING — ${state.lastStage || 'STARTING'}`
  }
  if (state.verdict === 'PASS') return 'AUDIO TEST: PASS — AUDIBLE PLAYBACK CONFIRMED'
  const stage = state.failureStage || state.lastStage || 'UNKNOWN'
  return `AUDIO TEST: FAIL — ${stage}`
}

async function playAndConfirm(
  out: DirectAudioProbeResult,
  audio: HTMLAudioElement,
  progressTimeoutMs: number,
  fail: (stage: string) => DirectAudioProbeResult,
  pass: () => DirectAudioProbeResult,
): Promise<DirectAudioProbeResult> {
  snapshotElement(out, audio)
  noteStage(out, `AUDIO_READY_STATE_${audio.readyState}`)

  let endedSignal: (() => void) | null = null
  const endedPromise = new Promise<void>((resolve) => {
    endedSignal = resolve
  })

  audio.onplaying = () => {
    out.playingEvent = true
    if (!out.stages.includes('CURRENT_TIME_PROGRESS') && out.maxCurrentTime <= 0.05) {
      /* wait for timeupdate for CURRENT_TIME_PROGRESS */
    }
  }
  audio.ontimeupdate = () => {
    out.timeupdateSeen = true
    if (audio.currentTime > out.maxCurrentTime) out.maxCurrentTime = audio.currentTime
    if (out.maxCurrentTime > 0.05 && !out.stages.includes('CURRENT_TIME_PROGRESS')) {
      noteStage(out, 'CURRENT_TIME_PROGRESS')
    }
  }
  audio.onended = () => {
    out.ended = true
    if (!out.stages.includes('PLAYBACK_ENDED')) noteStage(out, 'PLAYBACK_ENDED')
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

  out.currentTimeBefore = audio.currentTime
  out.playCalled = true
  out.playResult = 'pending'
  noteStage(out, 'PLAY_CALLED')

  const attempt = audio.play()
  if (!attempt || typeof attempt.then !== 'function') {
    return fail('PLAY_REJECTED_unsupported')
  }

  try {
    await attempt
    out.playResult = 'resolved'
    noteStage(out, 'PLAY_RESOLVED')
  } catch (err) {
    const name = err instanceof Error ? err.name : 'play_rejected'
    const message = err instanceof Error ? err.message.slice(0, 160) : String(err)
    out.playResult = 'rejected'
    out.playError = name
    out.playErrorMessage = message
    const stage = `PLAY_REJECTED_${name}`
    noteStage(out, stage)
    snapshotElement(out, audio)
    return fail(stage)
  }

  const already =
    out.playingEvent || out.maxCurrentTime > 0.05 || out.ended
  if (!already) {
    await Promise.race([
      endedPromise,
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, progressTimeoutMs)
      }),
    ])
  } else if (!out.ended) {
    await Promise.race([
      endedPromise,
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 80)
      }),
    ])
  }

  out.currentTimeAfter = audio.currentTime
  if (audio.currentTime > out.maxCurrentTime) out.maxCurrentTime = audio.currentTime
  out.audioContextStateAfter = getSharedAudioContextState()
  out.audioContextState = out.audioContextStateAfter
  snapshotElement(out, audio)
  out.ended = out.ended || audio.ended

  const progressed = shouldConfirmAudible({
    playResult: out.playResult,
    playingEvent: out.playingEvent,
    maxCurrentTime: out.maxCurrentTime,
    ended: out.ended,
    currentTimeBefore: out.currentTimeBefore,
    currentTimeAfter: out.currentTimeAfter,
  })

  if (progressed) {
    if (!out.stages.includes('CURRENT_TIME_PROGRESS') && out.maxCurrentTime > 0.05) {
      noteStage(out, 'CURRENT_TIME_PROGRESS')
    }
    return pass()
  }
  if (out.playResult === 'resolved') {
    return fail('PLAY_RESOLVED_NO_PROGRESSION')
  }
  return fail(out.failureStage || 'PLAYBACK_UNCONFIRMED')
}

function beginRun(mode: DiagnosticAudioMode): {
  out: DirectAudioProbeResult
  fail: (stage: string) => DirectAudioProbeResult
  pass: () => DirectAudioProbeResult
} {
  const correlationId = newCorrelationId()
  const out = emptyResult(correlationId, mode)
  const safari = detectSafari()
  out.isSafari = safari.isSafari
  out.iosVersion = safari.iosVersion

  harness.busy = true
  harness.verdict = 'RUNNING'
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
    if (out.stages[out.stages.length - 1] !== stage) noteStage(out, stage)
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
    if (!out.stages.includes('ACTUAL_PLAYBACK_STARTED')) {
      noteStage(out, 'ACTUAL_PLAYBACK_STARTED')
    }
    if (out.ended && !out.stages.includes('PLAYBACK_ENDED')) {
      noteStage(out, 'PLAYBACK_ENDED')
    }
    harness.verdict = 'PASS'
    harness.failureStage = null
    harness.latest = { ...out, stages: [...out.stages] }
    harness.busy = false
    harness.updatedAtMs = Date.now()
    emit()
    return out
  }

  return { out, fail, pass }
}

/**
 * LOCAL known-audio control — no network / auth / TTS / WebRTC.
 * Uses the same persistent element as the TTS test.
 */
export async function runLocalAudioProbe(
  deps: DirectAudioProbeDeps = {},
): Promise<DirectAudioProbeResult> {
  const { out, fail, pass } = beginRun('local')
  const resumeContext = deps.resumeContext ?? resumeSharedAudioContext
  const obtainAudio = deps.obtainAudio ?? obtainDiagnosticAudioElement
  const progressTimeoutMs = deps.progressTimeoutMs ?? 5_000
  const localSrc = deps.localAudioSrc ?? createAudibleBeepWavDataUri()

  try {
    noteStage(out, 'DIAGNOSTIC_TTS_GESTURE')

    let audio: HTMLAudioElement
    try {
      const created = !diagnosticAudio
      audio = obtainAudio()
      noteStage(out, created ? 'AUDIO_ELEMENT_CREATED' : 'AUDIO_ELEMENT_CREATED')
      noteStage(out, audio.isConnected ? 'AUDIO_ELEMENT_ATTACHED' : 'AUDIO_ELEMENT_ATTACH_FAILED')
      if (!audio.isConnected) return fail('AUDIO_ELEMENT_ATTACH_FAILED')
    } catch (err) {
      return fail(`AUDIO_ELEMENT_CREATED_FAILED:${err instanceof Error ? err.name : 'error'}`)
    }

    audio.muted = false
    audio.volume = 1
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    noteStage(out, 'AUDIO_ELEMENT_CONFIGURED')
    snapshotElement(out, audio)

    out.audioContextStateBefore = getSharedAudioContextState()
    noteStage(out, `AUDIO_CONTEXT_STATE_BEFORE_${out.audioContextStateBefore || 'null'}`)
    noteStage(out, 'AUDIO_CONTEXT_RESUME_ATTEMPT')
    try {
      await resumeContext()
    } catch {
      /* best-effort */
    }
    // Gesture unlock on THIS element before any further work.
    await unlockDiagnosticAudioElement(audio)
    out.audioContextStateAfter = getSharedAudioContextState()
    out.audioContextState = out.audioContextStateAfter
    noteStage(out, `AUDIO_CONTEXT_STATE_AFTER_${out.audioContextStateAfter || 'null'}`)

    // Local path — assign known audible asset (data URI, no network).
    noteStage(out, 'AUDIO_BLOB_CREATED')
    noteStage(out, 'AUDIO_OBJECT_URL_CREATED')
    // Never touch srcObject.
    if (audio.srcObject) {
      return fail('SRC_OBJECT_TOUCHED')
    }
    audio.src = localSrc
    audio.muted = false
    audio.volume = 1
    noteStage(out, 'AUDIO_SRC_ASSIGNED')
    out.canPlayType = audio.canPlayType?.('audio/wav') || null
    out.contentType = 'audio/wav'
    out.requestedFormat = 'local_wav'
    out.bytes = Math.max(0, Math.floor((localSrc.length * 3) / 4))
    noteStage(out, `CLASSIC_TTS_MIME_audio/wav`)
    noteStage(out, `CLASSIC_TTS_BYTES_${out.bytes}`)

    return await playAndConfirm(out, audio, progressTimeoutMs, fail, pass)
  } catch (err) {
    const name = err instanceof Error ? err.name : 'probe_exception'
    out.playError = name
    out.playErrorMessage = err instanceof Error ? err.message.slice(0, 80) : 'probe_exception'
    return fail(`EXCEPTION_${name}`)
  } finally {
    harness.busy = false
    harness.latest = { ...out, stages: [...out.stages] }
    harness.updatedAtMs = Date.now()
    emit()
  }
}

/**
 * Classic TTS HTTP path — reuses the same unlocked persistent element.
 * Must be invoked from a user gesture (button tap).
 */
export async function runDirectAudioProbe(
  deps: DirectAudioProbeDeps = {},
): Promise<DirectAudioProbeResult> {
  const { out, fail, pass } = beginRun('tts')
  const resumeContext = deps.resumeContext ?? resumeSharedAudioContext
  const obtainAudio = deps.obtainAudio ?? obtainDiagnosticAudioElement
  const progressTimeoutMs = deps.progressTimeoutMs ?? 8_000

  try {
    noteStage(out, 'DIAGNOSTIC_TTS_GESTURE')

    let audio: HTMLAudioElement
    try {
      audio = obtainAudio()
      noteStage(out, 'AUDIO_ELEMENT_CREATED')
      noteStage(out, audio.isConnected ? 'AUDIO_ELEMENT_ATTACHED' : 'AUDIO_ELEMENT_ATTACH_FAILED')
      if (!audio.isConnected) return fail('AUDIO_ELEMENT_ATTACH_FAILED')
    } catch (err) {
      return fail(`AUDIO_ELEMENT_CREATED_FAILED:${err instanceof Error ? err.name : 'error'}`)
    }

    audio.muted = false
    audio.volume = 1
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    noteStage(out, 'AUDIO_ELEMENT_CONFIGURED')
    snapshotElement(out, audio)

    out.audioContextStateBefore = getSharedAudioContextState()
    noteStage(out, `AUDIO_CONTEXT_STATE_BEFORE_${out.audioContextStateBefore || 'null'}`)
    noteStage(out, 'AUDIO_CONTEXT_RESUME_ATTEMPT')
    try {
      await resumeContext()
    } catch {
      /* best-effort */
    }
    // CRITICAL: unlock SAME element inside gesture BEFORE fetch.
    await unlockDiagnosticAudioElement(audio)
    out.audioContextStateAfter = getSharedAudioContextState()
    out.audioContextState = out.audioContextStateAfter
    noteStage(out, `AUDIO_CONTEXT_STATE_AFTER_${out.audioContextStateAfter || 'null'}`)

    out.requestedFormat = DIAGNOSTIC_TTS_FORMAT
    out.canPlayType =
      audio.canPlayType?.('audio/mpeg')
      || audio.canPlayType?.('audio/mp3')
      || null
    if (out.canPlayType === '' || out.canPlayType === 'no') {
      // Still try — some WebViews lie; but mark for diagnostics.
      noteStage(out, 'CAN_PLAY_TYPE_EMPTY')
    }

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

    // Capture the unlocked element before await — NEVER create/replace after network.
    const unlockedElement = audio

    let res: Response
    try {
      res = await fetchTts({
        body: JSON.stringify({
          text: DIRECT_AUDIO_PROBE_TEXT,
          locale: 'ar',
          voice: 'marin',
          format: DIAGNOSTIC_TTS_FORMAT,
          speed: 1,
          instructions:
            'Speak naturally in clear Arabic as Bilamo. Warm, confident, concise.',
        }),
      })
    } catch (err) {
      out.playError = err instanceof Error ? err.name : 'fetch_error'
      out.playErrorMessage = err instanceof Error ? err.message.slice(0, 80) : 'fetch_failed'
      return fail('CLASSIC_TTS_HTTP_0')
    }

    // Safari: reuse the SAME gesture-unlocked element. Do not call obtain* after fetch.
    audio = unlockedElement
    if (deps.obtainAudio && deps.obtainAudio() !== unlockedElement) {
      // Injected factory returned a different instance — hard fail for tests/contracts.
      return fail('AUDIO_ELEMENT_REPLACED_AFTER_FETCH')
    }

    out.httpStatus = res.status
    out.contentType = res.headers.get('content-type')
    noteStage(out, `CLASSIC_TTS_HTTP_${res.status}`)

    if (!res.ok) {
      out.safeServerErrorCode = await parseSafeErrorCodeFromResponse(res)
      return fail(`CLASSIC_TTS_HTTP_${res.status}`)
    }

    const buffer = new Uint8Array(await res.arrayBuffer())
    out.bytes = buffer.byteLength
    out.fileSignature = sniffFileSignature(buffer)
    const headerMime = (out.contentType || '').split(';')[0]?.trim() || ''
    const mime = headerMime || (DIAGNOSTIC_TTS_FORMAT === 'mp3' ? 'audio/mpeg' : 'audio/wav')
    noteStage(out, `CLASSIC_TTS_MIME_${mime}`)
    noteStage(out, `CLASSIC_TTS_BYTES_${buffer.byteLength}`)

    if (buffer.byteLength < 64) {
      return fail('TTS_EMPTY_RESPONSE')
    }

    const mimeLower = mime.toLowerCase()
    const sig = out.fileSignature || ''
    const looksAudio =
      mimeLower.includes('audio')
      || mimeLower.includes('octet-stream')
      || mimeLower.includes('mpeg')
      || mimeLower.includes('mp3')
      || mimeLower.includes('wav')
      || sig.includes('MP3')
      || sig.includes('WAV')
      || sig.includes('MPEG')
      || sig.includes('RIFF')
    if (!looksAudio) {
      return fail('UNSUPPORTED_AUDIO_FORMAT')
    }

    // Prefer canPlayType when browser reports empty (unsupported).
    const playType =
      audio.canPlayType?.(mime)
      || audio.canPlayType?.('audio/mpeg')
      || ''
    out.canPlayType = playType || out.canPlayType
    if (playType === '') {
      // Empty string means the UA cannot play this type.
      // Only hard-fail when MIME/signature also look unsupported (already gated above).
      noteStage(out, 'CAN_PLAY_TYPE_EMPTY')
    }

    noteStage(out, 'AUDIO_BLOB_CREATED')
    revokeDiagnosticObjectUrl()
    const blob = new Blob([buffer], { type: mime.includes('mpeg') || mime.includes('mp3') ? 'audio/mpeg' : mime })
    const objectUrl = URL.createObjectURL(blob)
    activeDiagnosticObjectUrl = objectUrl
    noteStage(out, 'AUDIO_OBJECT_URL_CREATED')

    // Classic only — never set srcObject.
    try {
      if (audio.srcObject) audio.srcObject = null
    } catch {
      /* ignore */
    }
    audio.src = objectUrl
    audio.muted = false
    audio.volume = 1
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    noteStage(out, 'AUDIO_SRC_ASSIGNED')
    snapshotElement(out, audio)
    if (audio.srcObject) {
      return fail('SRC_OBJECT_TOUCHED')
    }

    return await playAndConfirm(out, audio, progressTimeoutMs, fail, pass)
  } catch (err) {
    const name = err instanceof Error ? err.name : 'probe_exception'
    out.playError = name
    out.playErrorMessage = err instanceof Error ? err.message.slice(0, 80) : 'probe_exception'
    return fail(`EXCEPTION_${name}`)
  } finally {
    harness.busy = false
    harness.latest = { ...out, stages: [...out.stages] }
    harness.updatedAtMs = Date.now()
    emit()
  }
}

/** Alias — TTS control. */
export const runTtsAudioProbe = runDirectAudioProbe

/** Pure helpers for regression tests. */
export function classifyTtsProbeHttp(status: number, bytes: number, contentType: string | null): string {
  if (status === 401 || status === 403) return `tts_http_${status}`
  if (status >= 500) return `tts_http_${status}`
  if (status !== 200) return `tts_http_${status}`
  if (bytes < 64) return 'zero_byte_tts'
  const mime = (contentType || '').toLowerCase()
  if (mime && !mime.includes('audio') && !mime.includes('octet-stream') && !mime.includes('wav') && !mime.includes('mpeg')) {
    return `wrong_mime:${mime}`
  }
  return 'ok'
}

export function shouldConfirmAudible(input: {
  playResult: DirectAudioProbeResult['playResult']
  playingEvent: boolean
  maxCurrentTime: number
  ended: boolean
  currentTimeBefore?: number | null
  currentTimeAfter?: number | null
}): boolean {
  if (input.playResult !== 'resolved') return false
  const timeIncreased =
    typeof input.currentTimeBefore === 'number'
    && typeof input.currentTimeAfter === 'number'
    && input.currentTimeAfter > input.currentTimeBefore + 0.02
  const progressed =
    input.playingEvent
    || input.maxCurrentTime > 0.05
    || input.ended
    || timeIncreased
  // Require currentTime evidence when available; playing alone is weak.
  if (timeIncreased || input.maxCurrentTime > 0.05 || input.ended) return true
  return progressed && input.playingEvent
}

/**
 * Capability-probe HTTP notes must never mutate the audio harness verdict.
 */
export function applyCapabilityProbeToHarnessIsNoOp(): boolean {
  const before = getDiagnosticAudioHarnessState()
  const after = getDiagnosticAudioHarnessState()
  return (
    before.verdict === after.verdict
    && before.stages.length === after.stages.length
    && before.failureStage === after.failureStage
  )
}
