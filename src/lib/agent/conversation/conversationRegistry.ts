/**
 * Phase 3 Stage 1 — Conversation Orchestrator feature registry helpers.
 * Flag `ai.conversation_orchestrator` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { ConversationIntent } from './types'
import type { RuntimeStageId } from '../orchestrator/runtime/runtimeTypes'

export const CONVERSATION_ORCHESTRATOR_FEATURE_ID =
  'ai.conversation_orchestrator' as const

export function isConversationOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(CONVERSATION_ORCHESTRATOR_FEATURE_ID)
}

/** Intent → preferred runtime stages (never run unnecessary engines). */
export const INTENT_STAGE_MAP: Readonly<
  Record<ConversationIntent, readonly RuntimeStageId[]>
> = {
  destination_discovery: [
    'traveler_intelligence',
    'destination_intelligence',
    'recommendation_intelligence',
    'unified_consultant_response',
  ],
  trip_planning: [
    'reflection',
    'traveler_intelligence',
    'planning_graph',
    'destination_intelligence',
    'recommendation_intelligence',
    'travel_strategy',
    'unified_consultant_response',
  ],
  recommendation: [
    'traveler_intelligence',
    'destination_intelligence',
    'recommendation_intelligence',
    'unified_consultant_response',
  ],
  budget_optimization: [
    'traveler_intelligence',
    'travel_strategy',
    'recommendation_intelligence',
    'unified_consultant_response',
  ],
  itinerary_refinement: [
    'reflection',
    'planning_graph',
    'recommendation_intelligence',
    'unified_consultant_response',
  ],
  compare_destinations: [
    'traveler_intelligence',
    'destination_intelligence',
    'recommendation_intelligence',
    'unified_consultant_response',
  ],
  general_travel_advice: [
    'traveler_intelligence',
    'destination_intelligence',
    'unified_consultant_response',
  ],
  clarification_reply: [
    'reflection',
    'traveler_intelligence',
    'unified_consultant_response',
  ],
  continue_previous: [
    'reflection',
    'traveler_intelligence',
    'recommendation_intelligence',
    'unified_consultant_response',
  ],
}

export const ConversationRegistry = {
  featureId: CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  isEnabled: isConversationOrchestratorEnabled,
  intentStageMap: INTENT_STAGE_MAP,
}
