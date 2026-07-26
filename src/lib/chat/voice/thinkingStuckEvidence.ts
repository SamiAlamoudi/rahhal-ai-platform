/**
 * Evidence-only logger for iPhone “Thinking…” stuck after CHAT_REQUEST.
 * Enabled only when DEV or VITE_VOICE_TRACE=true. No behavior changes.
 */

export type ThinkingEvidenceEvent =
  | 'CHAT_REQUEST'
  | 'CHAT_RESPONSE'
  | 'ASSISTANT_RENDERED'
  | 'STATE_CHANGED'
  | 'REACT_RENDER'
  | 'MESSAGE_ADDED'
  | 'CONVERSATION_UPDATED'

export type ThinkingReactState = {
  voiceStatus?: string | null
  voiceUiState?: string | null
  sending?: boolean | null
  composerMode?: string | null
  isStreaming?: boolean | null
  activeId?: string | null
  waitingComponent?: string | null
  messageRoles?: string | null
  [key: string]: string | number | boolean | null | undefined
}

export type ThinkingEvidenceRecord = {
  event: ThinkingEvidenceEvent
  timestamp: string
  threadId: string | null
  conversationId: string | null
  messageCount: number | null
  assistantMessageId: string | null
  reactState: ThinkingReactState | null
  meta?: Record<string, string | number | boolean | null | undefined> | null
}

type Ctx = {
  threadId: string | null
  conversationId: string | null
  messageCount: number | null
  assistantMessageId: string | null
  reactState: ThinkingReactState | null
  armed: boolean
  renderCount: number
}

const ctx: Ctx = {
  threadId: null,
  conversationId: null,
  messageCount: null,
  assistantMessageId: null,
  reactState: null,
  armed: false,
  renderCount: 0,
}

const records: ThinkingEvidenceRecord[] = []

declare global {
  interface Window {
    __THINKING_EVIDENCE__?: ThinkingEvidenceRecord[]
  }
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

export function armThinkingEvidence(input: {
  threadId?: string | null
  conversationId?: string | null
}): void {
  if (!isThinkingEvidenceEnabled()) return
  ctx.armed = true
  ctx.renderCount = 0
  if (input.threadId) ctx.threadId = input.threadId
  if (input.conversationId) ctx.conversationId = input.conversationId
}

export function setThinkingEvidenceContext(partial: {
  threadId?: string | null
  conversationId?: string | null
  messageCount?: number | null
  assistantMessageId?: string | null
  reactState?: ThinkingReactState | null
}): void {
  if (!isThinkingEvidenceEnabled()) return
  if (partial.threadId !== undefined) ctx.threadId = partial.threadId
  if (partial.conversationId !== undefined) ctx.conversationId = partial.conversationId
  if (partial.messageCount !== undefined) ctx.messageCount = partial.messageCount
  if (partial.assistantMessageId !== undefined) ctx.assistantMessageId = partial.assistantMessageId
  if (partial.reactState !== undefined) {
    ctx.reactState = { ...(ctx.reactState ?? {}), ...(partial.reactState ?? {}) }
  }
}

export function thinkingEvidence(
  event: ThinkingEvidenceEvent,
  override?: {
    threadId?: string | null
    conversationId?: string | null
    messageCount?: number | null
    assistantMessageId?: string | null
    reactState?: ThinkingReactState | null
    meta?: Record<string, string | number | boolean | null | undefined> | null
  },
): void {
  if (!isThinkingEvidenceEnabled()) return

  if (event === 'CHAT_REQUEST') {
    ctx.armed = true
    ctx.renderCount = 0
  }

  if (override?.threadId !== undefined) ctx.threadId = override.threadId
  if (override?.conversationId !== undefined) ctx.conversationId = override.conversationId
  if (override?.messageCount !== undefined) ctx.messageCount = override.messageCount
  if (override?.assistantMessageId !== undefined) ctx.assistantMessageId = override.assistantMessageId
  if (override?.reactState) {
    ctx.reactState = { ...(ctx.reactState ?? {}), ...override.reactState }
  }

  // Avoid flooding: REACT_RENDER only while armed, and throttle after 40 samples.
  if (event === 'REACT_RENDER') {
    if (!ctx.armed) return
    ctx.renderCount += 1
    if (ctx.renderCount > 40 && ctx.renderCount % 10 !== 0) return
  }

  const record: ThinkingEvidenceRecord = {
    event,
    timestamp: new Date().toISOString(),
    threadId: override?.threadId ?? ctx.threadId,
    conversationId: override?.conversationId ?? ctx.conversationId,
    messageCount: override?.messageCount ?? ctx.messageCount,
    assistantMessageId: override?.assistantMessageId ?? ctx.assistantMessageId,
    reactState: override?.reactState
      ? { ...(ctx.reactState ?? {}), ...override.reactState }
      : ctx.reactState,
    meta: {
      ...(override?.meta ?? {}),
      renderCount: event === 'REACT_RENDER' ? ctx.renderCount : undefined,
    },
  }

  records.push(record)
  if (records.length > 120) records.splice(0, records.length - 120)
  if (typeof window !== 'undefined') {
    window.__THINKING_EVIDENCE__ = records
  }

  // eslint-disable-next-line no-console -- intentional iPhone evidence capture
  console.info('[rahhal.thinkingEvidence]', {
    event: record.event,
    timestamp: record.timestamp,
    threadId: record.threadId,
    conversationId: record.conversationId,
    messageCount: record.messageCount,
    assistantMessageId: record.assistantMessageId,
    reactState: record.reactState,
    meta: record.meta,
  })
}
