/**
 * On-device Thinking / voice-turn evidence bus (Preview / DEV only).
 * Feeds VOICE TRACE panel — no product behavior changes.
 */

export type ThinkingEvidenceEvent =
  | 'STT_START'
  | 'INTERIM_RESULT'
  | 'FINAL_RESULT'
  | 'TRANSCRIPT_CLEANED'
  | 'VOICE_SUBMIT'
  | 'MESSAGE_CREATED'
  | 'CHAT_REQUEST'
  | 'REQUEST_START'
  | 'REQUEST_SENT'
  | 'RESPONSE_RECEIVED'
  | 'RESPONSE_PARSED'
  | 'CHAT_RESPONSE'
  | 'MESSAGE_ADDED'
  | 'CONVERSATION_UPDATED'
  | 'ASSISTANT_RENDERED'
  | 'REACT_RENDER'
  | 'TTS_QUEUED'
  | 'TTS_START'
  | 'TTS_END'
  | 'TTS_ERROR'
  | 'TTS_TIMEOUT'
  | 'SPEECH_COMPLETED'
  | 'STATE_CHANGED'
  | 'REQUEST_ERROR'
  | 'REQUEST_ABORT'
  | 'REQUEST_TIMEOUT'
  | 'THINKING_TIMEOUT'
  | 'FAILURE'

export type ThinkingReactState = {
  voiceStatus?: string | null
  voiceUiState?: string | null
  sending?: boolean | null
  composerMode?: string | null
  isStreaming?: boolean | null
  activeId?: string | null
  waitingComponent?: string | null
  messageRoles?: string | null
  assistantBubbleRendered?: boolean | null
  [key: string]: string | number | boolean | null | undefined
}

export type ThinkingEvidenceRecord = {
  event: ThinkingEvidenceEvent
  timestamp: string
  sessionId: string | null
  conversationId: string | null
  turnId: string | null
  previousState: string | null
  nextState: string | null
  messageCount: number | null
  assistantMessageId: string | null
  waitingComponent: string | null
  success: boolean
  errorReason: string | null
  reactState: ThinkingReactState | null
  meta?: Record<string, string | number | boolean | null | undefined> | null
}

export type ThinkingStuckSnapshot = {
  frozenAt: string
  lastSuccessfulEvent: ThinkingEvidenceEvent | null
  firstMissingOrFailingEvent: string | null
  currentVoiceState: string | null
  currentReactState: ThinkingReactState | null
  waitingComponent: string | null
  messageCount: number | null
  assistantMessagePresent: boolean
  assistantBubbleRendered: boolean
  conversationId: string | null
  turnId: string | null
  sessionId: string | null
  eventsSinceArm: number
}

export type ThinkingEvidenceExport = {
  capturedAt: string
  sessionId: string | null
  turnId: string | null
  conversationId: string | null
  stuckSnapshot: ThinkingStuckSnapshot | null
  events: ThinkingEvidenceRecord[]
}

type Ctx = {
  turnId: string | null
  conversationId: string | null
  messageCount: number | null
  assistantMessageId: string | null
  reactState: ThinkingReactState | null
  previousState: string | null
  armed: boolean
  thinkingSince: number | null
  renderCount: number
  assistantBubbleRendered: boolean
  stuckSnapshot: ThinkingStuckSnapshot | null
}

const EXPECTED_AFTER_CHAT_REQUEST: ThinkingEvidenceEvent[] = [
  'REQUEST_START',
  'REQUEST_SENT',
  'RESPONSE_RECEIVED',
  'RESPONSE_PARSED',
  'CHAT_RESPONSE',
  'MESSAGE_ADDED',
  'ASSISTANT_RENDERED',
]

const THINKING_STUCK_MS = 15_000

const ctx: Ctx = {
  turnId: null,
  conversationId: null,
  messageCount: null,
  assistantMessageId: null,
  reactState: null,
  previousState: null,
  armed: false,
  thinkingSince: null,
  renderCount: 0,
  assistantBubbleRendered: false,
  stuckSnapshot: null,
}

const records: ThinkingEvidenceRecord[] = []
const listeners = new Set<() => void>()
let stuckTimer: ReturnType<typeof setTimeout> | null = null

declare global {
  interface Window {
    __THINKING_EVIDENCE__?: ThinkingEvidenceRecord[]
    __THINKING_EVIDENCE_EXPORT__?: ThinkingEvidenceExport
  }
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      /* ignore */
    }
  }
}

function syncWindow(): void {
  if (typeof window === 'undefined') return
  window.__THINKING_EVIDENCE__ = records
  window.__THINKING_EVIDENCE_EXPORT__ = buildThinkingEvidenceExport()
}

function getSessionIdSafe(): string | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { __VOICE_SESSION_ID__?: string }
  return w.__VOICE_SESSION_ID__ ?? null
}

export function isThinkingEvidenceEnabled(): boolean {
  try {
    return import.meta.env.DEV === true || import.meta.env.VITE_VOICE_TRACE === 'true'
  } catch {
    return false
  }
}

export function getThinkingEvidence(): readonly ThinkingEvidenceRecord[] {
  return records
}

export function getThinkingStuckSnapshot(): ThinkingStuckSnapshot | null {
  return ctx.stuckSnapshot
}

export function subscribeThinkingEvidence(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearThinkingEvidence(): void {
  records.length = 0
  ctx.armed = false
  ctx.thinkingSince = null
  ctx.renderCount = 0
  ctx.assistantBubbleRendered = false
  ctx.stuckSnapshot = null
  ctx.previousState = null
  if (stuckTimer) {
    clearTimeout(stuckTimer)
    stuckTimer = null
  }
  syncWindow()
  notify()
}

export function armThinkingEvidence(input: {
  threadId?: string | null
  turnId?: string | null
  conversationId?: string | null
}): void {
  if (!isThinkingEvidenceEnabled()) return
  ctx.armed = true
  ctx.renderCount = 0
  ctx.assistantBubbleRendered = false
  ctx.stuckSnapshot = null
  const turn = input.turnId ?? input.threadId
  if (turn) ctx.turnId = turn
  if (input.conversationId) ctx.conversationId = input.conversationId
  syncWindow()
  notify()
}

export function noteThinkingUiEntered(source = 'ui_thinking'): void {
  if (!isThinkingEvidenceEnabled()) return
  ctx.armed = true
  ctx.reactState = {
    ...ctx.reactState,
    voiceUiState: 'thinking',
    waitingComponent: source,
  }
  if (ctx.thinkingSince == null) {
    ctx.thinkingSince = Date.now()
    armStuckTimer()
  }
  syncWindow()
  notify()
}

function armStuckTimer(): void {
  if (stuckTimer) clearTimeout(stuckTimer)
  stuckTimer = setTimeout(() => {
    stuckTimer = null
    if (!isThinkingEvidenceEnabled() || !ctx.armed) return
    const voiceState =
      ctx.reactState?.voiceStatus
      ?? ctx.reactState?.voiceUiState
      ?? ctx.previousState
    const stillThinking =
      voiceState === 'thinking'
      || voiceState === 'processing'
      || ctx.reactState?.voiceUiState === 'thinking'
    if (!stillThinking) return
    freezeStuckSnapshot('THINKING_TIMEOUT')
    thinkingEvidence('THINKING_TIMEOUT', {
      success: false,
      errorReason: 'ui_thinking_exceeded_15s',
      reactState: {
        voiceUiState: 'thinking',
        waitingComponent: ctx.reactState?.waitingComponent ?? 'VoiceStateBadge/Thinking',
      },
      meta: { watchdogMs: THINKING_STUCK_MS, source: 'stuck_detector' },
    })
  }, THINKING_STUCK_MS)
}

function freezeStuckSnapshot(trigger: string): void {
  if (ctx.stuckSnapshot) return
  const seen = new Set(records.map((r) => r.event))
  const lastOk = [...records].reverse().find((r) => r.success)
  const firstMissing =
    EXPECTED_AFTER_CHAT_REQUEST.find((e) => !seen.has(e))
    ?? (seen.has('CHAT_REQUEST') ? 'CHAT_RESPONSE_OR_ASSISTANT_RENDERED' : 'CHAT_REQUEST')
  const firstFail = records.find((r) => !r.success)
  ctx.stuckSnapshot = {
    frozenAt: new Date().toISOString(),
    lastSuccessfulEvent: lastOk?.event ?? null,
    firstMissingOrFailingEvent: firstFail
      ? `${firstFail.event}:${firstFail.errorReason ?? 'fail'}`
      : firstMissing,
    currentVoiceState:
      ctx.reactState?.voiceStatus
      ?? ctx.reactState?.voiceUiState
      ?? null,
    currentReactState: ctx.reactState ? { ...ctx.reactState } : null,
    waitingComponent: ctx.reactState?.waitingComponent ?? null,
    messageCount: ctx.messageCount,
    assistantMessagePresent: Boolean(ctx.assistantMessageId),
    assistantBubbleRendered: ctx.assistantBubbleRendered,
    conversationId: ctx.conversationId,
    turnId: ctx.turnId,
    sessionId: getSessionIdSafe(),
    eventsSinceArm: records.length,
  }
  void trigger
  syncWindow()
  notify()
}

export function setThinkingEvidenceContext(partial: {
  threadId?: string | null
  turnId?: string | null
  conversationId?: string | null
  messageCount?: number | null
  assistantMessageId?: string | null
  reactState?: ThinkingReactState | null
}): void {
  if (!isThinkingEvidenceEnabled()) return
  if (partial.threadId !== undefined) ctx.turnId = partial.threadId
  if (partial.turnId !== undefined) ctx.turnId = partial.turnId
  if (partial.conversationId !== undefined) ctx.conversationId = partial.conversationId
  if (partial.messageCount !== undefined) ctx.messageCount = partial.messageCount
  if (partial.assistantMessageId !== undefined) ctx.assistantMessageId = partial.assistantMessageId
  if (partial.reactState) {
    ctx.reactState = { ...ctx.reactState, ...partial.reactState }
    if (partial.reactState.assistantBubbleRendered === true) {
      ctx.assistantBubbleRendered = true
    }
    const vs = partial.reactState.voiceStatus ?? partial.reactState.voiceUiState
    if (vs === 'thinking' || vs === 'processing') {
      noteThinkingUiEntered(String(partial.reactState.waitingComponent ?? 'STATE_CHANGED'))
    }
  } else if (partial.reactState === null) {
    ctx.reactState = null
  }
}

export function thinkingEvidence(
  event: ThinkingEvidenceEvent,
  override?: {
    threadId?: string | null
    turnId?: string | null
    conversationId?: string | null
    messageCount?: number | null
    assistantMessageId?: string | null
    previousState?: string | null
    nextState?: string | null
    waitingComponent?: string | null
    success?: boolean
    errorReason?: string | null
    reactState?: ThinkingReactState | null
    meta?: Record<string, string | number | boolean | null | undefined> | null
  },
): void {
  if (!isThinkingEvidenceEnabled()) return

  if (
    event === 'CHAT_REQUEST'
    || event === 'VOICE_SUBMIT'
    || event === 'STT_START'
  ) {
    ctx.armed = true
  }

  if (event === 'CHAT_REQUEST') {
    ctx.renderCount = 0
    ctx.thinkingSince = Date.now()
    armStuckTimer()
  }

  const turnId = override?.turnId ?? override?.threadId ?? ctx.turnId
  if (override?.threadId !== undefined) ctx.turnId = override.threadId
  if (override?.turnId !== undefined) ctx.turnId = override.turnId
  if (override?.conversationId !== undefined) ctx.conversationId = override.conversationId
  if (override?.messageCount !== undefined) ctx.messageCount = override.messageCount
  if (override?.assistantMessageId !== undefined) ctx.assistantMessageId = override.assistantMessageId
  if (override?.reactState) {
    ctx.reactState = { ...ctx.reactState, ...override.reactState }
    if (override.reactState.assistantBubbleRendered === true) {
      ctx.assistantBubbleRendered = true
    }
  }

  if (event === 'REACT_RENDER') {
    if (!ctx.armed) return
    ctx.renderCount += 1
    if (ctx.renderCount > 40 && ctx.renderCount % 10 !== 0) return
    if (override?.meta?.paintsAssistantBubble === true || override?.reactState?.assistantBubbleRendered) {
      ctx.assistantBubbleRendered = true
    }
  }

  // Collapse near-duplicate mirrors (voiceStage + direct thinkingEvidence).
  const last = records[records.length - 1]
  if (
    last
    && last.event === event
    && last.conversationId === (override?.conversationId ?? ctx.conversationId)
    && Date.parse(last.timestamp) > Date.now() - 40
  ) {
    return
  }

  const nextState =
    override?.nextState
    ?? override?.reactState?.voiceStatus
    ?? override?.reactState?.voiceUiState
    ?? ctx.reactState?.voiceStatus
    ?? null
  const previousState = override?.previousState ?? ctx.previousState
  const waiting =
    override?.waitingComponent
    ?? override?.reactState?.waitingComponent
    ?? ctx.reactState?.waitingComponent
    ?? null
  const success = override?.success !== false && !String(event).includes('ERROR') && event !== 'THINKING_TIMEOUT' && event !== 'FAILURE' && event !== 'REQUEST_ABORT' && event !== 'REQUEST_TIMEOUT'
  const explicitSuccess = override?.success
  const finalSuccess = explicitSuccess !== undefined ? explicitSuccess : success

  const record: ThinkingEvidenceRecord = {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getSessionIdSafe(),
    conversationId: override?.conversationId ?? ctx.conversationId,
    turnId,
    previousState,
    nextState,
    messageCount: override?.messageCount ?? ctx.messageCount,
    assistantMessageId: override?.assistantMessageId ?? ctx.assistantMessageId,
    waitingComponent: waiting,
    success: finalSuccess,
    errorReason: override?.errorReason ?? null,
    reactState: override?.reactState
      ? { ...ctx.reactState, ...override.reactState }
      : ctx.reactState,
    meta: {
      ...override?.meta,
      renderCount: event === 'REACT_RENDER' ? ctx.renderCount : undefined,
    },
  }

  if (nextState) ctx.previousState = nextState

  records.push(record)
  if (records.length > 160) records.splice(0, records.length - 160)

  if (
    event === 'CHAT_RESPONSE'
    || event === 'ASSISTANT_RENDERED'
    || event === 'TTS_END'
    || event === 'TTS_TIMEOUT'
    || event === 'SPEECH_COMPLETED'
  ) {
    ctx.thinkingSince = null
    if (stuckTimer) {
      clearTimeout(stuckTimer)
      stuckTimer = null
    }
  }

  syncWindow()
  notify()

  // eslint-disable-next-line no-console -- intentional Preview evidence
  console.info('[rahhal.thinkingEvidence]', {
    event: record.event,
    timestamp: record.timestamp,
    sessionId: record.sessionId,
    conversationId: record.conversationId,
    turnId: record.turnId,
    previousState: record.previousState,
    nextState: record.nextState,
    messageCount: record.messageCount,
    assistantMessageId: record.assistantMessageId,
    waitingComponent: record.waitingComponent,
    success: record.success,
    errorReason: record.errorReason,
    reactState: record.reactState,
  })
}

/** Mirror Voice Trace stages that already executed into the on-device evidence bus. */
export function mirrorVoiceStageToThinkingEvidence(input: {
  stage: string
  success: boolean
  conversationId?: string | null
  turnId?: string | null
  previousState?: string | null
  currentState?: string | null
  reason?: string | null
  meta?: Record<string, string | number | boolean | null | undefined> | null
}): void {
  if (!isThinkingEvidenceEnabled()) return
  const allowed = new Set<string>([
    'STT_START',
    'INTERIM_RESULT',
    'FINAL_RESULT',
    'TRANSCRIPT_CLEANED',
    'VOICE_SUBMIT',
    'MESSAGE_CREATED',
    'CHAT_REQUEST',
    'CHAT_RESPONSE',
    'ASSISTANT_RENDERED',
    'TTS_QUEUED',
    'TTS_START',
    'TTS_END',
    'TTS_ERROR',
    'TTS_TIMEOUT',
    'SPEECH_COMPLETED',
    'FAILURE',
  ])
  if (!allowed.has(input.stage)) return
  thinkingEvidence(input.stage as ThinkingEvidenceEvent, {
    conversationId: input.conversationId,
    turnId: input.turnId,
    previousState: input.previousState,
    nextState: input.currentState,
    success: input.success,
    errorReason: input.success ? null : (input.reason ?? input.stage),
    meta: input.meta,
  })
}

export function buildThinkingEvidenceExport(): ThinkingEvidenceExport {
  return {
    capturedAt: new Date().toISOString(),
    sessionId: getSessionIdSafe(),
    turnId: ctx.turnId,
    conversationId: ctx.conversationId,
    stuckSnapshot: ctx.stuckSnapshot,
    events: [...records],
  }
}

export function formatThinkingEvidenceJson(): string {
  return JSON.stringify(buildThinkingEvidenceExport(), null, 2)
}

/** @internal test helper */
export function __resetThinkingEvidenceForTests(): void {
  clearThinkingEvidence()
  ctx.turnId = null
  ctx.conversationId = null
  ctx.messageCount = null
  ctx.assistantMessageId = null
  ctx.reactState = null
}

/** @internal test helper */
export function __getThinkingStuckMsForTests(): number {
  return THINKING_STUCK_MS
}
