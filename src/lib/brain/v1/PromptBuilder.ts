/**
 * Sprint 81 — PromptBuilder (Brain v1).
 * Builds an internal prompt preview for future LLM wiring (not used in production).
 */

import type { BrainV1Plan } from './ConversationPlanner'
import type {
  BrainV1Clarification,
  BrainV1Entities,
  BrainV1Intent,
  BrainV1Offer,
} from './types'

export class PromptBuilder {
  build(input: {
    intent: BrainV1Intent
    entities: BrainV1Entities
    plan: BrainV1Plan
    topOffer?: BrainV1Offer | null
    clarification?: BrainV1Clarification | null
  }): string {
    const lines = [
      'Rahhal Brain v1 — internal prompt preview',
      `intent: ${input.intent}`,
      `destination: ${input.entities.destination ?? ''}`,
      `origin: ${input.entities.origin ?? ''}`,
      `dates: ${input.entities.travelDates.start ?? ''} → ${input.entities.travelDates.end ?? ''}`,
      `travelers: ${input.entities.travelerCount ?? ''}`,
      `plan: ${input.plan.kind}`,
    ]
    if (input.clarification) {
      lines.push(`clarify_field: ${input.clarification.field}`)
      lines.push(`clarify_ar: ${input.clarification.questionAr}`)
    }
    if (input.topOffer) {
      lines.push(`top_offer: ${input.topOffer.id} ${input.topOffer.title}`)
    }
    lines.push('role: senior Arabic-first travel consultant')
    lines.push('constraints: no invented inventory; ask one question max')
    return lines.join('\n')
  }
}

export function createPromptBuilder(): PromptBuilder {
  return new PromptBuilder()
}
