/**
 * Process-wide safe HTTP / auth trace for the active voice turn.
 * Never stores transcripts, JWTs, or OpenAI payloads.
 */

import {
  newVoiceCorrelationId,
  safeHttpErrorCode,
  type VoicePlaybackDiagnostics,
  type VoiceTurnStage,
} from './voicePlaybackDiagnostics'

export type VoiceHttpTraceSnapshot = {
  correlationId: string | null
  turnStage: VoiceTurnStage | null
  requestDispatched: boolean
  httpRoute: string | null
  httpStatus: number | null
  safeServerErrorCode: string | null
  realtimeSessionCreated: boolean | null
  classicFallbackHttpStatus: number | null
  classicFallbackBytes: number | null
  classicFallbackMime: string | null
  authenticatedUser: boolean | null
  supabaseSessionAvailable: boolean | null
  authProbeCode: string | null
  discardReason: string | null
  lastEvent: VoicePlaybackDiagnostics['lastEvent']
  language: string | null
  dialect: string | null
  transcriptConfidence: number | null
  normalizedIntent: string | null
  submitLatencyMs: number | null
  /** Per-turn classic TTS meta (never secrets / transcripts). */
  ttsRequestId: string | null
  ttsHttpStatus: number | null
  ttsBytes: number | null
  ttsObjectUrlAssigned: boolean
  turnId: number | null
}

let activeCorrelationId: string | null = null
let trace: VoiceHttpTraceSnapshot = emptyTrace()

function emptyTrace(): VoiceHttpTraceSnapshot {
  return {
    correlationId: null,
    turnStage: null,
    requestDispatched: false,
    httpRoute: null,
    httpStatus: null,
    safeServerErrorCode: null,
    realtimeSessionCreated: null,
    classicFallbackHttpStatus: null,
    classicFallbackBytes: null,
    classicFallbackMime: null,
    authenticatedUser: null,
    supabaseSessionAvailable: null,
    authProbeCode: null,
    discardReason: null,
    lastEvent: null,
    language: null,
    dialect: null,
    transcriptConfidence: null,
    normalizedIntent: null,
    submitLatencyMs: null,
    ttsRequestId: null,
    ttsHttpStatus: null,
    ttsBytes: null,
    ttsObjectUrlAssigned: false,
    turnId: null,
  }
}

/** @internal Vitest helper */
export function __resetVoiceHttpTraceForTests(): void {
  activeCorrelationId = null
  trace = emptyTrace()
}

export function beginVoiceTurnCorrelation(): string {
  activeCorrelationId = newVoiceCorrelationId()
  trace = {
    ...emptyTrace(),
    correlationId: activeCorrelationId,
    turnStage: 'listening',
    lastEvent: 'VOICE_REQUEST_CREATED',
  }
  return activeCorrelationId
}

export function getActiveVoiceCorrelationId(): string | null {
  return activeCorrelationId
}

export function noteVoiceTurnStage(stage: VoiceTurnStage): void {
  trace.turnStage = stage
  if (stage === 'idle') {
    trace.lastEvent = 'TURN_IDLE'
  }
}

export function noteVoiceAuthProbe(result: {
  authenticatedUser: boolean
  supabaseSessionAvailable: boolean
  authProbeCode: string | null
}): void {
  trace.authenticatedUser = result.authenticatedUser
  trace.supabaseSessionAvailable = result.supabaseSessionAvailable
  trace.authProbeCode = result.authProbeCode
  trace.lastEvent = 'AUTH_PROBE'
}

export function noteVoiceDiscardReason(reason: string): void {
  if (!/^[a-z0-9_]{3,48}$/i.test(reason)) return
  trace.discardReason = reason
}

/** Safe speech-understanding diagnostics — never pass raw transcript. */
export function noteSpeechUnderstandingDiag(input: {
  language: string
  dialect?: string | null
  transcriptConfidence: number
  normalizedIntent?: string | null
  submitLatencyMs?: number | null
}): void {
  trace.language = input.language
  trace.dialect = input.dialect ?? null
  trace.transcriptConfidence = Number(input.transcriptConfidence.toFixed(2))
  if (input.normalizedIntent && /^[a-z0-9:_.-]{2,64}$/i.test(input.normalizedIntent)) {
    trace.normalizedIntent = input.normalizedIntent
  }
  if (typeof input.submitLatencyMs === 'number' && Number.isFinite(input.submitLatencyMs)) {
    trace.submitLatencyMs = Math.round(input.submitLatencyMs)
  }
}

export function noteVoiceRequestDispatched(route: string): void {
  trace.requestDispatched = true
  trace.httpRoute = route
  trace.turnStage = trace.turnStage === 'listening' || trace.turnStage === 'finalizing'
    ? 'requesting'
    : (trace.turnStage ?? 'requesting')
  trace.lastEvent = 'VOICE_REQUEST_SENT'
}

export function noteVoiceHttpResult(opts: {
  route: string
  status: number
  bodyCode?: string | null
  /** realtime = SDP WebRTC call; realtime_capability = GET probe only (not a live session). */
  kind?: 'realtime' | 'realtime_session' | 'realtime_capability' | 'tts' | 'other'
  bytes?: number | null
  mime?: string | null
}): void {
  const code = safeHttpErrorCode(opts.status, opts.bodyCode ?? null)
  trace.httpRoute = opts.route
  trace.httpStatus = opts.status
  if (opts.status >= 400) {
    trace.safeServerErrorCode = code
  } else if (opts.status >= 200 && opts.status < 300) {
    if (trace.safeServerErrorCode?.startsWith('HTTP_') || !trace.safeServerErrorCode) {
      // Clear transient HTTP_* only; keep AUTH_* until next turn if still relevant.
      if (opts.kind !== 'tts' && opts.kind !== 'realtime_capability') {
        trace.safeServerErrorCode = null
      }
    }
    if (opts.kind === 'realtime_capability') {
      // Capability probe must NEVER look like a live WebRTC session.
      trace.lastEvent = 'REALTIME_CAPABILITY_OK'
    } else if (opts.kind === 'realtime' || opts.kind === 'realtime_session') {
      trace.realtimeSessionCreated = true
      trace.lastEvent = 'VOICE_REQUEST_ACCEPTED'
    } else if (opts.kind === 'tts') {
      trace.classicFallbackHttpStatus = opts.status
      if (typeof opts.bytes === 'number') trace.classicFallbackBytes = opts.bytes
      if (opts.mime) trace.classicFallbackMime = opts.mime
      if (opts.bytes != null && opts.bytes <= 0) {
        trace.lastEvent = 'CLASSIC_FALLBACK_FAILED'
      } else {
        trace.lastEvent = 'CLASSIC_TTS_HTTP_OK'
      }
    } else {
      trace.lastEvent = 'VOICE_REQUEST_ACCEPTED'
    }
  }
  if (opts.status >= 400) {
    if (opts.kind === 'realtime_capability') {
      trace.lastEvent = 'REALTIME_CAPABILITY_FAILED'
    } else if (opts.kind === 'tts') {
      trace.classicFallbackHttpStatus = opts.status
      if (typeof opts.bytes === 'number') trace.classicFallbackBytes = opts.bytes
      if (opts.mime) trace.classicFallbackMime = opts.mime
      trace.lastEvent = 'CLASSIC_FALLBACK_FAILED'
    }
  }
  if (opts.status === 401 || opts.status === 403) {
    trace.lastEvent = 'VOICE_REQUEST_AUTHENTICATED'
  }
}

export type VoiceLifecycleDetail = {
  code?: string | null
  turnId?: number | null
  requestId?: string | null
  status?: number | null
  bytes?: number | null
}

/** Only treat real failure / auth codes as safeServerErrorCode — never TTS request ids. */
function isSafeServerErrorCode(code: string): boolean {
  return /^(HTTP_[45]|AUTH_|PLAYBACK_|CREDIT_|OPENAI_|MIC_|LIFECYCLE_|UNSUPPORTED|TTS_UNAVAILABLE)/i.test(
    code,
  )
}

/** Stage-by-stage Safari lifecycle — no silent stalls. */
export function noteVoiceLifecycleStage(
  stage: VoicePlaybackDiagnostics['lastEvent'],
  detail?: VoiceLifecycleDetail,
): void {
  if (!stage) return
  trace.lastEvent = stage
  if (detail?.code && isSafeServerErrorCode(detail.code)) {
    trace.safeServerErrorCode = detail.code.toUpperCase()
  }
  if (typeof detail?.turnId === 'number' && Number.isFinite(detail.turnId)) {
    trace.turnId = detail.turnId
  }
  if (stage === 'TTS_REQUEST_STARTED') {
    if (typeof detail?.requestId === 'string' && detail.requestId.trim()) {
      trace.ttsRequestId = detail.requestId.trim()
    }
    // New TTS request — reset per-turn TTS meta for this speak.
    trace.ttsHttpStatus = null
    trace.ttsBytes = null
    trace.ttsObjectUrlAssigned = false
  }
  if (stage === 'TTS_HTTP_STATUS' && typeof detail?.status === 'number') {
    trace.ttsHttpStatus = detail.status
  }
  if (stage === 'TTS_BYTES' && typeof detail?.bytes === 'number') {
    trace.ttsBytes = detail.bytes
  }
  if (stage === 'TTS_OBJECT_URL_ASSIGNED') {
    trace.ttsObjectUrlAssigned = true
    if (typeof detail?.requestId === 'string' && detail.requestId.trim()) {
      trace.ttsRequestId = detail.requestId.trim()
    }
  }
}

export async function parseSafeErrorCodeFromResponse(res: Response): Promise<string | null> {
  try {
    const headerCode = res.headers.get('X-Rahhal-TTS-Safe-Code')
      || res.headers.get('x-rahhal-tts-safe-code')
    if (headerCode && /^[A-Z0-9_]{3,64}$/i.test(headerCode)) {
      return headerCode.toUpperCase()
    }
    const clone = res.clone()
    const ct = clone.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const body = (await clone.json()) as { code?: unknown; error?: unknown }
    for (const candidate of [body.code, body.error]) {
      if (typeof candidate === 'string' && /^[A-Z0-9_]{3,64}$/i.test(candidate)) {
        return candidate.toUpperCase()
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function getVoiceHttpTrace(): VoiceHttpTraceSnapshot {
  return { ...trace, correlationId: activeCorrelationId }
}

/** Merge process-wide HTTP/auth trace into session playback diagnostics (sticky). */
export function applyVoiceHttpTrace(
  diag: VoicePlaybackDiagnostics,
): VoicePlaybackDiagnostics {
  const t = getVoiceHttpTrace()
  return {
    ...diag,
    correlationId: diag.correlationId || t.correlationId,
    turnStage: t.turnStage ?? diag.turnStage,
    requestDispatched: diag.requestDispatched || t.requestDispatched,
    httpRoute: t.httpRoute ?? diag.httpRoute,
    httpStatus: t.httpStatus ?? diag.httpStatus,
    safeServerErrorCode: t.safeServerErrorCode ?? diag.safeServerErrorCode,
    realtimeSessionCreated: t.realtimeSessionCreated ?? diag.realtimeSessionCreated,
    classicFallbackHttpStatus: t.classicFallbackHttpStatus ?? diag.classicFallbackHttpStatus,
    classicFallbackBytes: t.classicFallbackBytes ?? diag.classicFallbackBytes,
    classicFallbackMime: t.classicFallbackMime ?? diag.classicFallbackMime,
    authenticatedUser: t.authenticatedUser ?? diag.authenticatedUser,
    supabaseSessionAvailable: t.supabaseSessionAvailable ?? diag.supabaseSessionAvailable,
    authProbeCode: t.authProbeCode ?? diag.authProbeCode,
    discardReason: t.discardReason ?? diag.discardReason,
    lastEvent: t.lastEvent ?? diag.lastEvent,
    language: t.language ?? diag.language,
    dialect: t.dialect ?? diag.dialect,
    transcriptConfidence: t.transcriptConfidence ?? diag.transcriptConfidence,
    normalizedIntent: t.normalizedIntent ?? diag.normalizedIntent,
    submitLatencyMs: t.submitLatencyMs ?? diag.submitLatencyMs,
    // Never promote bare play()/audioPlaybackStarted into audible.
    audible: diag.audible,
    ttsRequestId: t.ttsRequestId ?? diag.ttsRequestId,
    ttsHttpStatus: t.ttsHttpStatus ?? diag.ttsHttpStatus,
    ttsBytes: t.ttsBytes ?? diag.ttsBytes,
    ttsObjectUrlAssigned: diag.ttsObjectUrlAssigned || t.ttsObjectUrlAssigned,
    turnId: diag.turnId ?? t.turnId,
    timestampMs: Date.now(),
  }
}
