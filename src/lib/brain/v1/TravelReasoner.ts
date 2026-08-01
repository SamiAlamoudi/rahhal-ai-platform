/**
 * Sprint 81 — TravelReasoner (Brain v1).
 * Structured reasoning steps (foundation). Advanced reasoning deferred.
 */

import type {
  BrainV1Entities,
  BrainV1Intent,
  BrainV1MissingField,
  BrainV1Offer,
  BrainV1ReasoningStep,
  BrainV1ToolId,
} from './types'

export class TravelReasoner {
  reason(input: {
    intent: BrainV1Intent
    entities: BrainV1Entities
    missing: BrainV1MissingField[]
    tools: BrainV1ToolId[]
    ranked: BrainV1Offer[]
  }): BrainV1ReasoningStep[] {
    const steps: BrainV1ReasoningStep[] = [
      {
        id: 'understand_request',
        detail: `Intent=${input.intent}; destination=${input.entities.destination ?? 'unknown'}`,
        ok: input.intent !== 'unknown',
      },
      {
        id: 'detect_missing_information',
        detail: input.missing.length
          ? `Missing: ${input.missing.join(', ')}`
          : 'No required fields missing',
        ok: true,
      },
      {
        id: 'choose_best_provider',
        detail: input.tools.includes('none')
          ? 'No provider call yet (clarify or non-search intent)'
          : `Tools selected: ${input.tools.join(', ')}`,
        ok: true,
      },
      {
        id: 'merge_provider_results',
        detail: input.ranked.length
          ? `Merged ${input.ranked.length} candidate offers`
          : 'No provider results in this foundation turn',
        ok: true,
      },
      {
        id: 'rank_offers',
        detail: input.ranked[0]
          ? `Top offer ${input.ranked[0].id} score=${input.ranked[0].score ?? 0}`
          : 'Ranking skipped (empty)',
        ok: true,
      },
      {
        id: 'explain_recommendation',
        detail: input.ranked[0]?.reasons?.join('; ') || 'No recommendation explanation yet',
        ok: true,
      },
      {
        id: 'generate_conversational_response',
        detail: 'ResponseComposer will author traveler-facing text',
        ok: true,
      },
    ]
    return steps
  }
}

export function createTravelReasoner(): TravelReasoner {
  return new TravelReasoner()
}
