/**
 * Development-only voice pipeline tracing.
 * Enabled when DEV or VITE_VOICE_TRACE=true.
 * Never logs full private transcript contents in production builds.
 */

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

type TracePayload = {
  event: VoiceTraceEvent
  turnId?: string | null
  conversationId?: string | null
  /** Length only in production; short preview allowed in DEV. */
  transcriptLen?: number
  preview?: string
  reason?: string
  meta?: Record<string, string | number | boolean | null | undefined>
}

function tracingEnabled(): boolean {
  try {
    return import.meta.env.DEV === true || import.meta.env.VITE_VOICE_TRACE === 'true'
  } catch {
    return false
  }
}

function redactPreview(text: string | undefined): string | undefined {
  if (!text) return undefined
  if (import.meta.env.PROD && import.meta.env.VITE_VOICE_TRACE !== 'true') {
    return undefined
  }
  // DEV / explicit trace: short preview only.
  return text.length > 48 ? `${text.slice(0, 48)}…` : text
}

export function voiceTrace(payload: TracePayload): void {
  if (!tracingEnabled()) return
  const line = {
    ns: 'rahhal.voice',
    at: new Date().toISOString(),
    event: payload.event,
    turnId: payload.turnId ?? null,
    conversationId: payload.conversationId ?? null,
    transcriptLen: payload.transcriptLen ?? null,
    preview: redactPreview(payload.preview),
    reason: payload.reason ?? null,
    meta: payload.meta ?? null,
  }
  // eslint-disable-next-line no-console -- intentional temporary voice diagnostics
  console.info('[rahhal.voice]', line)
}
