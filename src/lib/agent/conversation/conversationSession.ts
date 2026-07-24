/**
 * Phase 3 Stage 2 — Conversation session helpers.
 */

import {
  createEmptyMultiTurnSession,
  isoNow,
  type ConversationTopic,
  type MultiTurnConversationSession,
  type MultiTurnHistoryEntry,
} from './memoryTypes'
import type { ConversationLocale } from './types'
import {
  loadMultiTurnSession,
  saveMultiTurnSession,
} from './conversationMemoryStore'

export function getOrCreateConversationSession(input: {
  conversationId: string
  sessionId?: string
  locale?: ConversationLocale
  now?: Date
}): MultiTurnConversationSession {
  const loaded = loadMultiTurnSession(input.conversationId, {
    sessionId: input.sessionId,
    locale: input.locale,
    createIfMissing: true,
  })
  if (loaded && loaded.turnNumber > 0) return loaded
  if (loaded) return loaded
  return createEmptyMultiTurnSession(input.conversationId, {
    sessionId: input.sessionId,
    locale: input.locale,
    now: input.now,
  })
}

export function appendSessionTurn(
  session: MultiTurnConversationSession,
  entry: Omit<MultiTurnHistoryEntry, 'turnNumber'> & { turnNumber?: number },
  now?: Date,
): MultiTurnConversationSession {
  const turnNumber =
    entry.role === 'user'
      ? Math.max(session.turnNumber + 1, entry.turnNumber ?? session.turnNumber + 1)
      : session.turnNumber
  const record: MultiTurnHistoryEntry = {
    turnNumber,
    role: entry.role,
    text: entry.text,
    topic: entry.topic,
    event: entry.event,
    at: entry.at || isoNow(now),
  }
  return {
    ...session,
    turnNumber: entry.role === 'user' ? turnNumber : session.turnNumber,
    conversationHistory: [...session.conversationHistory, record].slice(-60),
    updatedAt: isoNow(now),
  }
}

export function setSessionTopicGoal(
  session: MultiTurnConversationSession,
  options: {
    topic: ConversationTopic
    activeGoal?: string | null
    tripGoal?: string | null
    now?: Date
  },
): MultiTurnConversationSession {
  const tripGoal =
    options.tripGoal
    ?? session.tripGoal
    ?? (session.destinationFacts.destination
      ? `trip:${session.destinationFacts.destination}`
      : null)
  const activeGoal = options.activeGoal ?? options.topic
  return {
    ...session,
    conversationTopic: options.topic,
    activeGoal,
    tripGoal,
    updatedAt: isoNow(options.now),
  }
}

export function persistConversationSession(
  session: MultiTurnConversationSession,
): MultiTurnConversationSession {
  saveMultiTurnSession(session)
  return session
}

export const ConversationSession = {
  getOrCreate: getOrCreateConversationSession,
  appendTurn: appendSessionTurn,
  setTopicGoal: setSessionTopicGoal,
  persist: persistConversationSession,
}
