/**
 * Sprint 98 — Live Conversation Experience contracts (presentation only).
 */

export const SPRINT98_LIVE_CONVERSATION_VERSION = '1.0.0-live-conversation'

/** Session states for live concierge conversation UX. */
export type LiveConversationSessionState =
  | 'thinking'
  | 'searching'
  | 'comparing'
  | 'optimizing'
  | 'final_recommendation'
  | 'booking_ready'

export type ConversationStatus =
  | 'idle'
  | 'in_progress'
  | 'streaming'
  | 'completed'
  | 'interrupted'
  | 'recovered'
  | 'error'

export type ConversationPhase =
  | 'intake'
  | 'reasoning'
  | 'discovery'
  | 'evaluation'
  | 'recommendation'
  | 'booking'

export const LIVE_CONVERSATION_STAGE_ORDER: LiveConversationSessionState[] = [
  'thinking',
  'searching',
  'comparing',
  'optimizing',
  'final_recommendation',
  'booking_ready',
]

export const LIVE_CONVERSATION_STAGE_LABELS: Record<LiveConversationSessionState, string> = {
  thinking: 'Thinking…',
  searching: 'Searching flights…',
  comparing: 'Comparing hotels…',
  optimizing: 'Checking prices…',
  final_recommendation: 'Building package…',
  booking_ready: 'Preparing recommendation…',
}

/** Chunk copy for incremental / streaming-ready rendering. */
export const LIVE_CONVERSATION_STREAM_CHUNKS: Record<LiveConversationSessionState, string> = {
  thinking: 'Thinking…',
  searching: 'Searching flights…',
  comparing: 'Comparing hotels…',
  optimizing: 'Checking prices…',
  final_recommendation: 'Building package…',
  booking_ready: 'Preparing recommendation…',
}

export interface ConversationTimelineDto {
  currentStage: LiveConversationSessionState | null
  completedStages: LiveConversationSessionState[]
  remainingStages: LiveConversationSessionState[]
  estimatedProgress: number
  stageLabels: Partial<Record<LiveConversationSessionState, string>>
}

export interface StreamingChunkDto {
  sequence: number
  stage: LiveConversationSessionState
  text: string
  isFinal: boolean
  progressPercent: number
}

export interface TypingMetadataDto {
  responseDelay: number
  estimatedRemaining: number
  streamSequence: number
}

export interface ConversationProgressEvent {
  name: 'conversation.progress'
  at: string
  conversationId: string
  stage: LiveConversationSessionState
  status: ConversationStatus
  phase: ConversationPhase
  progressPercent: number
  message: string
  streamSequence: number
}

export interface LiveConversationSessionDto {
  conversationId: string
  state: LiveConversationSessionState
  status: ConversationStatus
  phase: ConversationPhase
  timeline: ConversationTimelineDto
  chunks: StreamingChunkDto[]
  typing: TypingMetadataDto
  events: ConversationProgressEvent[]
  interrupted: boolean
  recovered: boolean
  version: string
  durationMs: number
}

export interface LiveConversationResponseMeta {
  version: string
  conversationId: string
  state: LiveConversationSessionState
  status: ConversationStatus
  phase: ConversationPhase
  estimatedProgress: number
  streamSequence: number
  chunkCount: number
  responseDelay: number
  estimatedRemaining: number
  interrupted: boolean
  recovered: boolean
  durationMs: number
}

export interface BuildLiveConversationInput {
  conversationId?: string
  /** Target end state (default final_recommendation). */
  targetState?: LiveConversationSessionState
  /** Concierge / legacy mode hint for delays only. */
  mode?: 'legacy' | 'concierge'
  /** Simulate interruption before a stage. */
  interruptAt?: LiveConversationSessionState | null
  /** Recover after interruption. */
  recover?: boolean
  /** Explicit now for tests. */
  now?: () => number
  /** Base delay ms between chunks (default 120). */
  baseDelayMs?: number
}
