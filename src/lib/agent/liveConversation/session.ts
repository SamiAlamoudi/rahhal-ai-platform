/**
 * Sprint 98 — live conversation session builder + progress events.
 */

import {
  LIVE_CONVERSATION_STAGE_LABELS,
  LIVE_CONVERSATION_STAGE_ORDER,
  LIVE_CONVERSATION_STREAM_CHUNKS,
  SPRINT98_LIVE_CONVERSATION_VERSION,
  type BuildLiveConversationInput,
  type ConversationPhase,
  type ConversationProgressEvent,
  type ConversationStatus,
  type ConversationTimelineDto,
  type LiveConversationResponseMeta,
  type LiveConversationSessionDto,
  type LiveConversationSessionState,
  type StreamingChunkDto,
  type TypingMetadataDto,
} from './types'

function phaseFor(state: LiveConversationSessionState): ConversationPhase {
  switch (state) {
    case 'thinking':
      return 'reasoning'
    case 'searching':
      return 'discovery'
    case 'comparing':
    case 'optimizing':
      return 'evaluation'
    case 'final_recommendation':
      return 'recommendation'
    case 'booking_ready':
      return 'booking'
    default:
      return 'intake'
  }
}

function progressForIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round(((index + 1) / total) * 100))
}

export function buildConversationTimeline(
  current: LiveConversationSessionState | null,
  options?: { completedThrough?: LiveConversationSessionState | null },
): ConversationTimelineDto {
  const order = LIVE_CONVERSATION_STAGE_ORDER
  const through = options?.completedThrough ?? current
  const throughIdx = through ? order.indexOf(through) : -1
  const currentIdx = current ? order.indexOf(current) : -1

  const completedStages = throughIdx >= 0 ? order.slice(0, throughIdx + 1) : []
  // If still "in" current stage and not finished booking_ready, remaining excludes completed
  const remainingStart = Math.max(throughIdx + 1, currentIdx >= 0 && throughIdx < currentIdx ? currentIdx : throughIdx + 1)
  const remainingStages = remainingStart >= 0 ? order.slice(remainingStart) : [...order]

  const estimatedProgress = throughIdx < 0
    ? 0
    : progressForIndex(throughIdx, order.length)

  return {
    currentStage: current,
    completedStages,
    remainingStages,
    estimatedProgress,
    stageLabels: { ...LIVE_CONVERSATION_STAGE_LABELS },
  }
}

export function buildStreamingChunks(
  upTo: LiveConversationSessionState,
  options?: { interrupted?: boolean },
): StreamingChunkDto[] {
  const order = LIVE_CONVERSATION_STAGE_ORDER
  const endIdx = order.indexOf(upTo)
  if (endIdx < 0) return []
  const chunks: StreamingChunkDto[] = []
  for (let i = 0; i <= endIdx; i += 1) {
    const stage = order[i]
    chunks.push({
      sequence: i + 1,
      stage,
      text: LIVE_CONVERSATION_STREAM_CHUNKS[stage],
      isFinal: !options?.interrupted && i === endIdx && stage === 'booking_ready',
      progressPercent: progressForIndex(i, order.length),
    })
  }
  return chunks
}

export function buildTypingMetadata(input: {
  streamSequence: number
  remainingStages: number
  mode?: 'legacy' | 'concierge'
  baseDelayMs?: number
}): TypingMetadataDto {
  const base = input.baseDelayMs ?? (input.mode === 'concierge' ? 100 : 140)
  const responseDelay = base
  const estimatedRemaining = Math.max(0, input.remainingStages) * base
  return {
    responseDelay,
    estimatedRemaining,
    streamSequence: input.streamSequence,
  }
}

export function createProgressEvent(input: {
  conversationId: string
  stage: LiveConversationSessionState
  status: ConversationStatus
  progressPercent: number
  message: string
  streamSequence: number
  now?: () => number
}): ConversationProgressEvent {
  const now = input.now ?? Date.now
  return {
    name: 'conversation.progress',
    at: new Date(now()).toISOString(),
    conversationId: input.conversationId,
    stage: input.stage,
    status: input.status,
    phase: phaseFor(input.stage),
    progressPercent: input.progressPercent,
    message: input.message,
    streamSequence: input.streamSequence,
  }
}

function newConversationId(now: number): string {
  return `live_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build a full live-conversation session snapshot (UI-ready, streaming-ready).
 */
export function buildLiveConversationSession(
  input: BuildLiveConversationInput = {},
): LiveConversationSessionDto {
  const started = (input.now ?? Date.now)()
  const conversationId = input.conversationId?.trim() || newConversationId(started)
  const target = input.targetState ?? 'final_recommendation'
  const order = LIVE_CONVERSATION_STAGE_ORDER
  const targetIdx = order.indexOf(target)
  const interruptAt = input.interruptAt ?? null
  const interruptIdx = interruptAt ? order.indexOf(interruptAt) : -1

  let interrupted = false
  let recovered = false
  let endIdx = targetIdx >= 0 ? targetIdx : order.length - 2

  if (interruptIdx >= 0 && interruptIdx <= endIdx) {
    interrupted = true
    endIdx = interruptIdx
  }
  if (interrupted && input.recover) {
    recovered = true
    interrupted = false
    endIdx = targetIdx >= 0 ? targetIdx : order.length - 2
  }

  const state = order[Math.max(0, endIdx)] ?? 'thinking'
  const chunks = buildStreamingChunks(state, {
    interrupted: interrupted && !recovered,
  })
  // If recovered, rebuild full chunks to target
  const finalChunks = recovered
    ? buildStreamingChunks(order[targetIdx] ?? 'final_recommendation')
    : chunks

  const timeline = buildConversationTimeline(state, {
    completedThrough: state,
  })

  // If not yet booking_ready, remaining should exclude current completed
  if (state !== 'booking_ready') {
    const idx = order.indexOf(state)
    timeline.remainingStages = order.slice(idx + 1)
    timeline.completedStages = order.slice(0, idx + 1)
    timeline.estimatedProgress = progressForIndex(idx, order.length)
  }

  const streamSequence = finalChunks.length
  const typing = buildTypingMetadata({
    streamSequence,
    remainingStages: timeline.remainingStages.length,
    mode: input.mode ?? 'legacy',
    baseDelayMs: input.baseDelayMs,
  })

  const status: ConversationStatus = interrupted
    ? 'interrupted'
    : recovered
      ? 'recovered'
      : state === 'booking_ready' || state === 'final_recommendation'
        ? 'completed'
        : 'streaming'

  const events: ConversationProgressEvent[] = finalChunks.map((chunk) =>
    createProgressEvent({
      conversationId,
      stage: chunk.stage,
      status: chunk.isFinal ? 'completed' : (interrupted && chunk.stage === state ? 'interrupted' : 'streaming'),
      progressPercent: chunk.progressPercent,
      message: chunk.text,
      streamSequence: chunk.sequence,
      now: input.now,
    }),
  )

  if (recovered) {
    events.push(createProgressEvent({
      conversationId,
      stage: state,
      status: 'recovered',
      progressPercent: timeline.estimatedProgress,
      message: 'Conversation recovered — continuing recommendation.',
      streamSequence: streamSequence + 1,
      now: input.now,
    }))
  }

  return {
    conversationId,
    state,
    status,
    phase: phaseFor(state),
    timeline,
    chunks: finalChunks,
    typing,
    events,
    interrupted,
    recovered,
    version: SPRINT98_LIVE_CONVERSATION_VERSION,
    durationMs: Math.max(0, (input.now ?? Date.now)() - started),
  }
}

export function toLiveConversationResponseMeta(
  session: LiveConversationSessionDto,
): LiveConversationResponseMeta {
  return {
    version: session.version,
    conversationId: session.conversationId,
    state: session.state,
    status: session.status,
    phase: session.phase,
    estimatedProgress: session.timeline.estimatedProgress,
    streamSequence: session.typing.streamSequence,
    chunkCount: session.chunks.length,
    responseDelay: session.typing.responseDelay,
    estimatedRemaining: session.typing.estimatedRemaining,
    interrupted: session.interrupted,
    recovered: session.recovered,
    durationMs: session.durationMs,
  }
}

/** Empty legacy-compatible session (feature off). */
export function emptyLiveConversationSession(
  conversationId?: string,
): LiveConversationSessionDto {
  return {
    conversationId: conversationId ?? 'live_disabled',
    state: 'thinking',
    status: 'idle',
    phase: 'intake',
    timeline: {
      currentStage: null,
      completedStages: [],
      remainingStages: [...LIVE_CONVERSATION_STAGE_ORDER],
      estimatedProgress: 0,
      stageLabels: { ...LIVE_CONVERSATION_STAGE_LABELS },
    },
    chunks: [],
    typing: {
      responseDelay: 0,
      estimatedRemaining: 0,
      streamSequence: 0,
    },
    events: [],
    interrupted: false,
    recovered: false,
    version: SPRINT98_LIVE_CONVERSATION_VERSION,
    durationMs: 0,
  }
}
