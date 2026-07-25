/**
 * Phase 3 Stage 1 — Conversation planner.
 * Selects which Runtime Coordinator stages to run for an intent.
 */

import { INTENT_STAGE_MAP } from './conversationRegistry'
import type { ConversationIntent, ConversationState } from './types'
import type { RuntimeStageId } from '../orchestrator/runtime/runtimeTypes'

export function planConversationStages(
  intent: ConversationIntent,
  state: ConversationState,
): RuntimeStageId[] {
  const base = [...(INTENT_STAGE_MAP[intent] ?? INTENT_STAGE_MAP.general_travel_advice)]

  // Clarification replies: keep light unless destination still unknown.
  if (intent === 'clarification_reply') {
    if (!state.knownFacts.destination && !state.currentTrip.destination) {
      return uniqueStages([
        ...base,
        'destination_intelligence',
        'recommendation_intelligence',
      ])
    }
    return uniqueStages(base)
  }

  // Continue previous: prefer last intent's map when available.
  if (intent === 'continue_previous' && state.lastIntent && state.lastIntent !== 'continue_previous') {
    return uniqueStages([...(INTENT_STAGE_MAP[state.lastIntent] ?? base)])
  }

  // Always ensure unified response when any intelligence stage runs.
  if (base.length && !base.includes('unified_consultant_response')) {
    base.push('unified_consultant_response')
  }

  return uniqueStages(base)
}

function uniqueStages(stages: RuntimeStageId[]): RuntimeStageId[] {
  return [...new Set(stages)]
}

export const ConversationPlanner = {
  planStages: planConversationStages,
}
