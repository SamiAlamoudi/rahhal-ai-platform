/**
 * Phase 3 Stage 1 — Conversation memory store (in-process).
 * Append-only facts; user corrections win. No PII logging beyond opaque ids.
 */

import { createEmptyConversationState } from './conversationState'
import {
  isoNow,
  uniqueStrings,
  type ConversationKnownFacts,
  type ConversationLocale,
  type ConversationState,
  type ConversationTurnRecord,
  type ConversationIntent,
} from './types'

const store = new Map<string, ConversationState>()

export function loadConversationMemory(
  conversationId: string,
  locale: ConversationLocale = 'ar',
): ConversationState {
  const existing = store.get(conversationId)
  if (existing) return cloneState(existing)
  return createEmptyConversationState(conversationId, locale)
}

export function saveConversationMemory(state: ConversationState): void {
  store.set(state.conversationId, cloneState(state))
}

export function resetConversationMemory(conversationId?: string): void {
  if (conversationId) store.delete(conversationId)
  else store.clear()
}

/**
 * Merge known facts — only append / fill empties.
 * Explicit non-null corrections from `incoming` always win.
 */
export function mergeKnownFacts(
  base: ConversationKnownFacts,
  incoming?: ConversationKnownFacts | null,
): ConversationKnownFacts {
  if (!incoming) {
    return {
      ...base,
      interests: [...(base.interests ?? [])],
    }
  }
  const interests = uniqueStrings([
    ...(base.interests ?? []),
    ...(incoming.interests ?? []),
  ])
  return {
    destination: pickCorrection(base.destination, incoming.destination),
    origin: pickCorrection(base.origin, incoming.origin),
    budgetAmount: pickCorrectionNum(base.budgetAmount, incoming.budgetAmount),
    budgetCurrency: pickCorrection(base.budgetCurrency, incoming.budgetCurrency),
    durationDays: pickCorrectionNum(base.durationDays, incoming.durationDays),
    adults: pickCorrectionNum(base.adults, incoming.adults),
    children: pickCorrectionNum(base.children, incoming.children),
    monthHint: pickCorrectionNum(base.monthHint, incoming.monthHint),
    interests,
    tripPurpose: pickCorrection(base.tripPurpose, incoming.tripPurpose),
    compareWith: pickCorrection(base.compareWith, incoming.compareWith),
  }
}

function pickCorrection(
  prev: string | null | undefined,
  next: string | null | undefined,
): string | null | undefined {
  if (next === undefined) return prev
  if (next === null) return prev ?? null
  if (typeof next === 'string' && next.trim()) return next.trim()
  return prev
}

function pickCorrectionNum(
  prev: number | null | undefined,
  next: number | null | undefined,
): number | null | undefined {
  if (next === undefined) return prev
  if (next === null) return prev ?? null
  if (typeof next === 'number' && Number.isFinite(next)) return next
  return prev
}

export function appendConversationTurn(
  state: ConversationState,
  turn: Omit<ConversationTurnRecord, 'turnNumber'> & { turnNumber?: number },
  now?: Date,
): ConversationState {
  const turnNumber = turn.turnNumber ?? state.turnNumber + (turn.role === 'user' ? 1 : 0)
  const record: ConversationTurnRecord = {
    turnNumber: turn.role === 'user' ? Math.max(state.turnNumber + 1, turnNumber) : state.turnNumber,
    role: turn.role,
    text: turn.text,
    intent: turn.intent,
    timestamp: turn.timestamp || isoNow(now),
  }
  return {
    ...state,
    turnNumber: record.role === 'user' ? record.turnNumber : state.turnNumber,
    conversationHistory: [...state.conversationHistory, record].slice(-40),
    updatedAt: isoNow(now),
  }
}

export function markQuestionAnswered(
  state: ConversationState,
  question: string | null | undefined,
  now?: Date,
): ConversationState {
  if (!question) return state
  const key = normalizeQuestionKey(question)
  return {
    ...state,
    answeredQuestions: uniqueStrings([...state.answeredQuestions, key]).slice(-40),
    pendingClarification:
      state.pendingClarification
      && normalizeQuestionKey(state.pendingClarification) === key
        ? null
        : state.pendingClarification,
    updatedAt: isoNow(now),
  }
}

export function setPendingClarification(
  state: ConversationState,
  question: string | null,
  now?: Date,
): ConversationState {
  return {
    ...state,
    pendingClarification: question,
    updatedAt: isoNow(now),
  }
}

export function setMissingInformation(
  state: ConversationState,
  missing: string[],
  now?: Date,
): ConversationState {
  return {
    ...state,
    missingInformation: uniqueStrings(missing).slice(0, 16),
    updatedAt: isoNow(now),
  }
}

export function wasQuestionAsked(state: ConversationState, question: string): boolean {
  const key = normalizeQuestionKey(question)
  return state.answeredQuestions.includes(key)
    || (state.pendingClarification != null
      && normalizeQuestionKey(state.pendingClarification) === key)
}

export function normalizeQuestionKey(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160)
}

function cloneState(state: ConversationState): ConversationState {
  return {
    ...state,
    answeredQuestions: [...state.answeredQuestions],
    missingInformation: [...state.missingInformation],
    activeGoals: [...state.activeGoals],
    currentTrip: { ...state.currentTrip },
    conversationHistory: state.conversationHistory.map((t) => ({ ...t })),
    knownFacts: {
      ...state.knownFacts,
      interests: [...(state.knownFacts.interests ?? [])],
    },
  }
}

export function withLastIntent(
  state: ConversationState,
  intent: ConversationIntent,
  now?: Date,
): ConversationState {
  return { ...state, lastIntent: intent, updatedAt: isoNow(now) }
}

export const ConversationMemory = {
  load: loadConversationMemory,
  save: saveConversationMemory,
  reset: resetConversationMemory,
  mergeFacts: mergeKnownFacts,
  appendTurn: appendConversationTurn,
  markAnswered: markQuestionAnswered,
  setPending: setPendingClarification,
  setMissing: setMissingInformation,
  wasAsked: wasQuestionAsked,
}
