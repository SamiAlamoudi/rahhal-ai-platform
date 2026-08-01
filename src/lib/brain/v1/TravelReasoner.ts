/**
 * Sprint 82 — TravelReasoner (Brain v1).
 * Executes the multi-step reasoning trace for each consultant turn.
 */

import type {
  BrainV1Entities,
  BrainV1Explanation,
  BrainV1Intent,
  BrainV1MissingField,
  BrainV1Offer,
  BrainV1PlannerState,
  BrainV1PreferenceMemory,
  BrainV1ReasoningStep,
  BrainV1ToolId,
} from './types'

export class TravelReasoner {
  reason(input: {
    intent: BrainV1Intent
    entities: BrainV1Entities
    missing: BrainV1MissingField[]
    tools: BrainV1ToolId[]
    collected: BrainV1Offer[]
    ranked: BrainV1Offer[]
    explanation: BrainV1Explanation | null
    planner: BrainV1PlannerState
    preferenceMemory: BrainV1PreferenceMemory
    bookingActionCount: number
  }): BrainV1ReasoningStep[] {
    const contextDetail = input.planner.resumed
      ? `Resumed conversation; goal=${input.planner.currentGoal}`
      : `Fresh context; goal=${input.planner.currentGoal}`

    const memoryDetail = [
      input.preferenceMemory.preferredAirlines[0]
        ? `preferredAirline=${input.preferenceMemory.preferredAirlines[0]}`
        : null,
      input.preferenceMemory.typicalBudget != null
        ? `typicalBudget=${input.preferenceMemory.typicalBudget}`
        : null,
      input.preferenceMemory.cabinClass
        ? `cabin=${input.preferenceMemory.cabinClass}`
        : null,
    ]
      .filter(Boolean)
      .join(', ') || 'No preference memory loaded'

    return [
      {
        id: 'understand_request',
        detail: `Intent=${input.intent}; destination=${input.entities.destination ?? 'unknown'}`,
        ok: input.intent !== 'unknown',
      },
      {
        id: 'resolve_conversation_context',
        detail: contextDetail,
        ok: true,
      },
      {
        id: 'load_memory',
        detail: memoryDetail,
        ok: true,
      },
      {
        id: 'detect_missing_information',
        detail: input.missing.length
          ? `Missing: ${input.missing.join(', ')}`
          : 'No required fields missing',
        ok: true,
      },
      {
        id: 'choose_tools',
        detail: input.tools.includes('none')
          ? 'No provider call yet (clarify or non-search intent)'
          : `Tools selected via registry: ${input.tools.join(', ')}`,
        ok: true,
      },
      {
        id: 'collect_provider_results',
        detail: input.collected.length
          ? `Collected ${input.collected.length} injectable provider results`
          : 'No provider results collected this turn',
        ok: true,
      },
      {
        id: 'evaluate_results',
        detail: input.collected.length
          ? `Evaluated ${input.collected.length} offers for feasibility`
          : 'Evaluation skipped (empty collection)',
        ok: true,
      },
      {
        id: 'rank_offers',
        detail: input.ranked[0]
          ? `Top offer ${input.ranked[0].id} overall=${input.ranked[0].score ?? 0}`
          : 'Ranking skipped (empty)',
        ok: true,
      },
      {
        id: 'explain_recommendation',
        detail: input.explanation?.en ?? 'No recommendation explanation',
        ok: true,
      },
      {
        id: 'generate_natural_answer',
        detail: 'ResponseComposer authors traveler-facing text',
        ok: true,
      },
      {
        id: 'generate_booking_actions',
        detail: input.bookingActionCount
          ? `Prepared ${input.bookingActionCount} booking action(s)`
          : 'No booking actions this turn',
        ok: true,
      },
    ]
  }
}

export function createTravelReasoner(): TravelReasoner {
  return new TravelReasoner()
}
