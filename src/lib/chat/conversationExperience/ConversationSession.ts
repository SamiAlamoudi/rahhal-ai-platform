/**
 * Sprint 32 — ConversationSession + ConversationMessage factories.
 */

import type {
  ConversationMessage,
  ConversationSession,
  ConversationState,
  ConversationStructuredResponse,
  ConversationCommandKind,
} from './types'
import { createInitialConversationState } from './ConversationState'

export function createConversationMessage(input: {
  conversationId: string
  role: ConversationMessage['role']
  content: string
  structured?: ConversationStructuredResponse | null
  commandKind?: ConversationCommandKind | null
  meta?: Record<string, unknown>
}): ConversationMessage {
  const now = new Date().toISOString()
  return {
    id: `msg_${Math.random().toString(36).slice(2, 10)}`,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    createdAt: now,
    structured: input.structured ?? null,
    commandKind: input.commandKind ?? null,
    meta: input.meta,
  }
}

export function createConversationSession(input: {
  conversationId: string
  title?: string
  locale?: 'ar' | 'en'
  state?: ConversationState
}): ConversationSession {
  const now = new Date().toISOString()
  return {
    id: `sess_${input.conversationId}`,
    conversationId: input.conversationId,
    title: input.title ?? 'Travel conversation',
    state: input.state ?? createInitialConversationState(input.locale ?? 'en'),
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function appendMessage(
  session: ConversationSession,
  message: ConversationMessage,
): ConversationSession {
  return {
    ...session,
    messages: [...session.messages, message],
    updatedAt: new Date().toISOString(),
  }
}

export function updateSessionState(
  session: ConversationSession,
  state: ConversationState,
): ConversationSession {
  return {
    ...session,
    state,
    updatedAt: new Date().toISOString(),
  }
}
