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
  kind?: 'realtime' | 'realtime_session' | 'tts' | 'other'
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
      if (opts.kind !== 'tts') trace.safeServerErrorCode = null
    }
    if (opts.kind === 'realtime' || opts.kind === 'realtime_session') {
      trace.realtimeSessionCreated = true
      trace.lastEvent = 'VOICE_REQUEST_ACCEPTED'
    } else if (opts.kind === 'tts') {
      trace.classicFallbackHttpStatus = opts.status
      if (typeof opts.bytes === 'number') trace.classicFallbackBytes = opts.bytes
      if (opts.mime) trace.classicFallbackMime = opts.mime
      trace.lastEvent = opts.bytes != null && opts.bytes <= 0
        ? 'CLASSIC_FALLBACK_FAILED'
        : 'CLASSIC_FALLBACK_OK'
    } else {
      trace.lastEvent = 'VOICE_REQUEST_ACCEPTED'
    }
  }
  if (opts.status >= 400) {
    if (opts.kind === 'tts') {
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

export async function parseSafeErrorCodeFromResponse(res: Response): Promise<string | null> {
  try {
    const clone = res.clone()
    const ct = clone.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const body = (await clone.json()) as { code?: unknown }
    if (typeof body.code === 'string' && /^[A-Z0-9_]{3,48}$/.test(body.code)) {
      return body.code
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
    timestampMs: Date.now(),
  }
}
