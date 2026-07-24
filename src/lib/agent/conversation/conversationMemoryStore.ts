/**
 * Phase 3 Stage 2 — Multi-turn conversation memory store (in-process).
 * Append-only session persistence. No PII logging beyond opaque ids.
 */

import {
  cloneMultiTurnSession,
  createEmptyMultiTurnSession,
  syncWorkingFromSession,
  type MultiTurnConversationSession,
} from './memoryTypes'
import type { ConversationLocale } from './types'

const store = new Map<string, MultiTurnConversationSession>()

function key(conversationId: string, sessionId?: string): string {
  const sid = sessionId?.trim() || `session-${conversationId}`
  return `${conversationId}::${sid}`
}

export function loadMultiTurnSession(
  conversationId: string,
  options?: { sessionId?: string; locale?: ConversationLocale; createIfMissing?: boolean },
): MultiTurnConversationSession | null {
  const k = key(conversationId, options?.sessionId)
  const existing = store.get(k)
  if (existing) return cloneMultiTurnSession(existing)

  // Fallback: any session for this conversationId
  for (const session of store.values()) {
    if (session.conversationId === conversationId) {
      return cloneMultiTurnSession(session)
    }
  }

  if (options?.createIfMissing === false) return null
  return createEmptyMultiTurnSession(conversationId, {
    sessionId: options?.sessionId,
    locale: options?.locale,
  })
}

export function saveMultiTurnSession(session: MultiTurnConversationSession): void {
  const synced = syncWorkingFromSession(session)
  store.set(key(session.conversationId, session.sessionId), cloneMultiTurnSession(synced))
}

export function resetMultiTurnSessions(conversationId?: string): void {
  if (!conversationId) {
    store.clear()
    return
  }
  for (const [k, session] of store.entries()) {
    if (session.conversationId === conversationId) store.delete(k)
  }
}

export function listMultiTurnSessionIds(conversationId: string): string[] {
  const ids: string[] = []
  for (const session of store.values()) {
    if (session.conversationId === conversationId) ids.push(session.sessionId)
  }
  return ids
}

export const ConversationMemoryStore = {
  load: loadMultiTurnSession,
  save: saveMultiTurnSession,
  reset: resetMultiTurnSessions,
  list: listMultiTurnSessionIds,
}
