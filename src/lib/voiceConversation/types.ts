/**
 * Sprint 18 — Voice Conversation Foundation types.
 * Architecture only: no realtime network, no TTS audio, no fake dialogue.
 */

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'interrupted'
  | 'disconnected'
  | 'error'

export type VoiceMessageRole = 'user' | 'assistant' | 'system'

export type VoiceMessageModality = 'speech' | 'text' | 'system'

export interface VoiceMessage {
  id: string
  conversationId: string
  role: VoiceMessageRole
  modality: VoiceMessageModality
  content: string
  /** Milliseconds from session start when this message was committed. */
  offsetMs: number
  createdAt: string
  meta?: Record<string, unknown>
}

export type VoiceEventType =
  | 'session_started'
  | 'session_ended'
  | 'state_changed'
  | 'user_speech_started'
  | 'user_speech_ended'
  | 'user_transcript'
  | 'assistant_response_queued'
  | 'assistant_speech_started'
  | 'assistant_speech_ended'
  | 'thinking_started'
  | 'thinking_ended'
  | 'interrupted'
  | 'paused'
  | 'resumed'
  | 'error'
  | 'reconnect_attempt'
  | 'reconnected'
  | 'disconnected'
  | 'latency_sample'
  | 'queue_enqueued'
  | 'queue_cancelled'
  | 'timeline_marker'

export type VoiceEventPriority = 'normal' | 'high' | 'critical'

export interface VoiceEvent {
  id: string
  type: VoiceEventType
  conversationId: string
  createdAt: string
  priority: VoiceEventPriority
  payload?: Record<string, unknown>
}

export type VoiceTimelineKind =
  | 'user_speech'
  | 'assistant_speech'
  | 'thinking'
  | 'latency'
  | 'error'
  | 'reconnect'
  | 'conversation'
  | 'state'

export interface VoiceTimelineEntry {
  id: string
  conversationId: string
  kind: VoiceTimelineKind
  label: string
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  meta?: Record<string, unknown>
}

export interface VoiceSessionSnapshot {
  conversationId: string
  state: VoiceState
  previousState: VoiceState | null
  connected: boolean
  providerId: string
  messages: VoiceMessage[]
  timeline: VoiceTimelineEntry[]
  lastError: string | null
  startedAt: string | null
  listeningSince: string | null
  speakingSince: string | null
  interruptedCount: number
  reconnectCount: number
  /**
   * Sprint 20 — last BrainResponsePlan from speech transcript (when brain.voice is on).
   */
  lastBrainPlan: {
    intent: string
    action: string
    summary: string
    assistantGoal: string
    missingFields: string[]
  } | null
  /**
   * Sprint 23 — last TravelExecutionTurnResult from speech (when brain.execution is on).
   */
  lastExecution: unknown | null
  /**
   * Sprint 24 — last SearchAggregationTurnResult from speech (when brain.search is on).
   */
  lastSearch: unknown | null
}

export type VoiceSessionTransitionReason =
  | 'start'
  | 'stop'
  | 'user_speech_end'
  | 'assistant_ready'
  | 'assistant_done'
  | 'interrupt'
  | 'pause'
  | 'resume'
  | 'disconnect'
  | 'reconnect'
  | 'error'
  | 'reset'

export interface VoiceStateTransition {
  from: VoiceState
  to: VoiceState
  reason: VoiceSessionTransitionReason
  at: string
}
