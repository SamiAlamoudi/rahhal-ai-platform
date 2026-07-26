/**
 * Preview / DEV voice pipeline stage tracing (Phase 2.5).
 * Enabled only when DEV or VITE_VOICE_TRACE=true — zero production impact otherwise.
 * Does not log full private transcript contents unless VITE_VOICE_TRACE is explicitly on.
 */

export type VoicePipelineStage =
  | 'MIC_PERMISSION'
  | 'STT_START'
  | 'INTERIM_RESULT'
  | 'FINAL_RESULT'
  | 'TRANSCRIPT_CLEANED'
  | 'VOICE_SUBMIT'
  | 'MESSAGE_CREATED'
  | 'CHAT_REQUEST'
  | 'CHAT_RESPONSE'
  | 'ASSISTANT_RENDERED'
  | 'TTS_START'
  | 'TTS_END'
  | 'LISTENING_RESUMED'
  | 'FAILURE'

/** Legacy event names kept for existing call sites. */
export type VoiceTraceEvent =
  | 'final_transcript_received'
  | 'cleaned_transcript'
  | 'submission_requested'
  | 'submission_accepted'
  | 'submission_rejected'
  | 'conversation_id'
  | 'user_message_committed'
  | 'chat_engine_started'
  | 'chat_engine_completed'
  | 'assistant_message_committed'
  | 'tts_started'
  | 'tts_ended'
  | 'listening_resumed'
  | 'failure'

export type VoiceTraceRecord = {
  id: string
  timestamp: string
  stage: VoicePipelineStage
  success: boolean
  conversationId: string | null
  voiceSessionId: string | null
  turnId: string | null
  previousState: string | null
  currentState: string | null
  durationMs: number | null
  reason: string | null
  stack: string | null
  browserCapability: Record<string, boolean | string> | null
  recoveryAction: string | null
  transcriptLen: number | null
  preview: string | null
  meta: Record<string, string | number | boolean | null | undefined> | null
}

type TracePayload = {
  event: VoiceTraceEvent
  turnId?: string | null
  conversationId?: string | null
  transcriptLen?: number
  preview?: string
  reason?: string
  meta?: Record<string, string | number | boolean | null | undefined>
  success?: boolean
  previousState?: string | null
  currentState?: string | null
  durationMs?: number | null
  stack?: string | null
  recoveryAction?: string | null
}

type StagePayload = {
  stage: VoicePipelineStage
  success?: boolean
  turnId?: string | null
  conversationId?: string | null
  voiceSessionId?: string | null
  previousState?: string | null
  currentState?: string | null
  durationMs?: number | null
  reason?: string | null
  stack?: string | null
  recoveryAction?: string | null
  transcriptLen?: number
  preview?: string
  meta?: Record<string, string | number | boolean | null | undefined>
  error?: unknown
}

const MAX_RECORDS = 80
const listeners = new Set<() => void>()
const records: VoiceTraceRecord[] = []

let voiceSessionId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `vs_${crypto.randomUUID().slice(0, 8)}`
    : `vs_${Date.now().toString(36)}`
let lastState: string | null = 'IDLE'
const stageStartedAt = new Map<VoicePipelineStage, number>()

function publishVoiceSessionId(): void {
  if (typeof window === 'undefined') return
  ;(window as Window & { __VOICE_SESSION_ID__?: string }).__VOICE_SESSION_ID__ = voiceSessionId
}
publishVoiceSessionId()

const EVENT_TO_STAGE: Record<VoiceTraceEvent, VoicePipelineStage> = {
  final_transcript_received: 'FINAL_RESULT',
  cleaned_transcript: 'TRANSCRIPT_CLEANED',
  submission_requested: 'VOICE_SUBMIT',
  submission_accepted: 'VOICE_SUBMIT',
  submission_rejected: 'FAILURE',
  conversation_id: 'MESSAGE_CREATED',
  user_message_committed: 'MESSAGE_CREATED',
  chat_engine_started: 'CHAT_REQUEST',
  chat_engine_completed: 'CHAT_RESPONSE',
  assistant_message_committed: 'ASSISTANT_RENDERED',
  tts_started: 'TTS_START',
  tts_ended: 'TTS_END',
  listening_resumed: 'LISTENING_RESUMED',
  failure: 'FAILURE',
}

export function isVoiceTracingEnabled(): boolean {
  try {
    return import.meta.env.DEV === true || import.meta.env.VITE_VOICE_TRACE === 'true'
  } catch {
    return false
  }
}

export function getVoiceSessionId(): string {
  return voiceSessionId
}

export function resetVoiceSessionId(): string {
  voiceSessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `vs_${crypto.randomUUID().slice(0, 8)}`
      : `vs_${Date.now().toString(36)}`
  publishVoiceSessionId()
  return voiceSessionId
}

export function getVoiceTraceRecords(): readonly VoiceTraceRecord[] {
  return records
}

export function subscribeVoiceTrace(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // ignore subscriber errors
    }
  }
}

function redactPreview(text: string | undefined): string | null {
  if (!text) return null
  if (import.meta.env.PROD && import.meta.env.VITE_VOICE_TRACE !== 'true') {
    return null
  }
  return text.length > 48 ? `${text.slice(0, 48)}…` : text
}

export function collectBrowserVoiceCapability(): Record<string, boolean | string> {
  if (typeof window === 'undefined') {
    return { environment: 'non-browser' }
  }
  const w = window as unknown as {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
    speechSynthesis?: SpeechSynthesis
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return {
    speechRecognition: !!(w.SpeechRecognition || w.webkitSpeechRecognition),
    webkitSpeechRecognition: !!w.webkitSpeechRecognition,
    speechSynthesis: !!w.speechSynthesis,
    mediaDevices: !!(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia),
    userAgent: ua.slice(0, 120),
    language: typeof navigator !== 'undefined' ? navigator.language : '',
  }
}

function stackFromError(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack.slice(0, 1200)
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return null
}

function pushRecord(record: VoiceTraceRecord): void {
  records.push(record)
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS)
  // eslint-disable-next-line no-console -- intentional temporary voice diagnostics
  console.info('[rahhal.voice]', {
    stage: record.stage,
    success: record.success,
    at: record.timestamp,
    conversationId: record.conversationId,
    voiceSessionId: record.voiceSessionId,
    previousState: record.previousState,
    currentState: record.currentState,
    durationMs: record.durationMs,
    reason: record.reason,
    recoveryAction: record.recoveryAction,
    transcriptLen: record.transcriptLen,
    preview: record.preview,
    meta: record.meta,
    browserCapability: record.browserCapability,
    stack: record.stack,
  })
  notify()
}

export function voiceStage(payload: StagePayload): void {
  if (!isVoiceTracingEnabled()) return

  const success = payload.success !== false && payload.stage !== 'FAILURE'
  const previousState = payload.previousState ?? lastState
  const currentState = payload.currentState ?? lastState
  if (payload.currentState) lastState = payload.currentState

  const started = stageStartedAt.get(payload.stage)
  const durationMs =
    payload.durationMs
    ?? (started != null ? Math.max(0, Date.now() - started) : null)
  if (success || payload.stage === 'FAILURE') {
    stageStartedAt.delete(payload.stage)
  } else {
    stageStartedAt.set(payload.stage, Date.now())
  }

  const failed = !success || payload.stage === 'FAILURE'
  const reason = payload.reason ?? (payload.error instanceof Error ? payload.error.message : null)
  pushRecord({
    id: `vt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    stage: payload.stage,
    success: !failed,
    conversationId: payload.conversationId ?? null,
    voiceSessionId: payload.voiceSessionId ?? voiceSessionId,
    turnId: payload.turnId ?? null,
    previousState,
    currentState,
    durationMs,
    reason,
    stack: payload.stack ?? (failed ? stackFromError(payload.error) : null),
    browserCapability: failed ? collectBrowserVoiceCapability() : null,
    recoveryAction: payload.recoveryAction ?? (failed ? 'inspect_trace_and_retry_voice' : null),
    transcriptLen: payload.transcriptLen ?? null,
    preview: redactPreview(payload.preview),
    meta: payload.meta ?? null,
  })

  // Mirror executed stages into on-device Thinking evidence (no behavior change).
  void import('./thinkingStuckEvidence')
    .then(({ mirrorVoiceStageToThinkingEvidence }) => {
      mirrorVoiceStageToThinkingEvidence({
        stage: payload.stage,
        success: !failed,
        conversationId: payload.conversationId,
        turnId: payload.turnId,
        previousState,
        currentState,
        reason,
        meta: payload.meta ?? null,
      })
    })
    .catch(() => {
      /* evidence optional */
    })
}

/** Mark the start of a stage for duration measurement. */
export function voiceStageStart(stage: VoicePipelineStage, currentState?: string): void {
  if (!isVoiceTracingEnabled()) return
  stageStartedAt.set(stage, Date.now())
  if (currentState) {
    const previousState = lastState
    lastState = currentState
    voiceStage({
      stage,
      success: true,
      previousState,
      currentState,
      durationMs: 0,
      meta: { phase: 'start' },
    })
  }
}

export function voiceTrace(payload: TracePayload): void {
  if (!isVoiceTracingEnabled()) return
  const stage = EVENT_TO_STAGE[payload.event]
  const success =
    payload.success
    ?? (payload.event !== 'failure' && payload.event !== 'submission_rejected')
  voiceStage({
    stage,
    success,
    turnId: payload.turnId,
    conversationId: payload.conversationId,
    previousState: payload.previousState,
    currentState: payload.currentState,
    durationMs: payload.durationMs,
    reason: payload.reason,
    stack: payload.stack,
    recoveryAction: payload.recoveryAction,
    transcriptLen: payload.transcriptLen,
    preview: payload.preview,
    meta: {
      ...payload.meta,
      legacyEvent: payload.event,
    },
  })
}

export function clearVoiceTrace(): void {
  records.length = 0
  stageStartedAt.clear()
  lastState = 'IDLE'
  notify()
}

/** Compact timestamped timeline for Preview / tests. */
export function getVoiceTraceTimeline(): Array<{
  at: string
  stage: VoicePipelineStage
  success: boolean
  reason: string | null
  msFromStart: number
}> {
  const start = records[0] ? Date.parse(records[0].timestamp) : Date.now()
  return records.map((r) => ({
    at: r.timestamp,
    stage: r.stage,
    success: r.success,
    reason: r.reason,
    msFromStart: Math.max(0, Date.parse(r.timestamp) - start),
  }))
}
