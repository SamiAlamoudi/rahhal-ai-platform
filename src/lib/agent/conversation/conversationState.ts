/**
 * Phase 3 Stage 1 — Conversation state helpers.
 */

import {
  isoNow,
  type ConversationKnownFacts,
  type ConversationLocale,
  type ConversationState,
  type ConversationIntent,
} from './types'

export function createEmptyConversationState(
  conversationId: string,
  locale: ConversationLocale = 'ar',
  now?: Date,
): ConversationState {
  return {
    conversationId,
    locale,
    turnNumber: 0,
    answeredQuestions: [],
    missingInformation: [],
    activeGoals: [],
    currentTrip: {},
    pendingClarification: null,
    conversationHistory: [],
    knownFacts: {},
    lastIntent: null,
    updatedAt: isoNow(now),
  }
}

export function withIntentGoal(
  state: ConversationState,
  intent: ConversationIntent,
  now?: Date,
): ConversationState {
  const goals = [...state.activeGoals]
  if (!goals.includes(intent)) goals.push(intent)
  return {
    ...state,
    activeGoals: goals.slice(-8),
    lastIntent: intent,
    updatedAt: isoNow(now),
  }
}

export function syncTripFromFacts(
  state: ConversationState,
  facts: ConversationKnownFacts,
  now?: Date,
): ConversationState {
  return {
    ...state,
    currentTrip: {
      destination: facts.destination ?? state.currentTrip.destination ?? null,
      durationDays: facts.durationDays ?? state.currentTrip.durationDays ?? null,
      budgetAmount: facts.budgetAmount ?? state.currentTrip.budgetAmount ?? null,
      budgetCurrency: facts.budgetCurrency ?? state.currentTrip.budgetCurrency ?? null,
    },
    updatedAt: isoNow(now),
  }
}

export const ConversationStateHelpers = {
  create: createEmptyConversationState,
  withIntentGoal,
  syncTripFromFacts,
}
