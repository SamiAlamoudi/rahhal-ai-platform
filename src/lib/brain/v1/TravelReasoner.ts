/**
 * Sprint 82/87 — TravelReasoner (Brain v1).
 * Executes the multi-step reasoning trace for each consultant turn.
 * Sprint 87: connects structured destination insights (season, weather, costs, …).
 */

import {
  buildDestinationReasoningLines,
  getDestinationInsight,
  inferTripStyle,
  readTaggedDuration,
} from './destinationInsights'
import type { TravelPlanSlots } from './planning/types'
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
    /** Optional planning slots for Sprint 87 destination reasoning. */
    planSlots?: TravelPlanSlots | null
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

    const slots: TravelPlanSlots | null = input.planSlots ?? null
    const insight = slots
      ? getDestinationInsight(slots.destination, slots.specialRequests)
      : getDestinationInsight(input.entities.destination, null)
    const style = slots
      ? inferTripStyle({
          durationDays: readTaggedDuration(slots.specialRequests),
          specialRequests: slots.specialRequests,
          adults: slots.adults,
          children: slots.children,
        })
      : inferTripStyle({
          specialRequests: null,
          adults: input.entities.adults,
          children: input.entities.children,
        })
    const destinationLines = slots
      ? buildDestinationReasoningLines(slots)
      : insight
        ? [
            `destination=${insight.destinationKey}`,
            `season=${insight.seasonNoteEn}`,
            `style=${style}`,
          ]
        : []

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
        id: 'destination_reasoning',
        detail: destinationLines.length
          ? destinationLines.join('; ')
          : 'No structured destination insight for this turn',
        ok: true,
      },
      {
        id: 'trip_style_reasoning',
        detail: `tripStyle=${style}; familyVsSolo=${
          style === 'family' ? 'family' : style === 'solo' ? 'solo' : 'unspecified'
        }; businessVsTourism=${style === 'business' ? 'business' : 'tourism_or_leisure'}`,
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
