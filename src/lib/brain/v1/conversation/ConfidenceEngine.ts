/**
 * Sprint 85 — Confidence Engine.
 * Tracks confidence for intent, entities, slots, recommendations.
 * Low confidence → ask clarification.
 */

import type { BrainV1IntentResult } from '../types'
import type { TravelPlanSlotKey, TravelPlanSlots } from '../planning/types'
import type { ConversationConfidence } from './types'

const LOW = 0.55

export class ConfidenceEngine {
  evaluate(input: {
    intent: BrainV1IntentResult
    slots: TravelPlanSlots
    completedSlots: TravelPlanSlotKey[]
    pendingSlots: TravelPlanSlotKey[]
    recommendations?: string[]
    ambiguousText?: boolean
  }): ConversationConfidence {
    const intent = clamp(input.intent.confidence)
    const filled = input.completedSlots.length
    const pending = input.pendingSlots.length
    const slotRatio = filled + pending === 0 ? 0.4 : filled / (filled + pending)
    const slots = clamp(slotRatio)

    let entities = 0.35
    if (input.slots.destination) entities += 0.25
    if (input.slots.dates.start || input.slots.flexibleDates) entities += 0.2
    if (input.slots.origin) entities += 0.1
    if (input.slots.adults != null) entities += 0.1
    if (input.ambiguousText) entities -= 0.2
    entities = clamp(entities)

    const recommendations = input.recommendations?.length
      ? clamp(0.5 + Math.min(0.4, input.recommendations.length * 0.15))
      : pending === 0
        ? 0.6
        : 0.35

    const overall = clamp(intent * 0.3 + entities * 0.3 + slots * 0.25 + recommendations * 0.15)
    const lowConfidence = overall < LOW || intent < LOW
    const needsClarification = lowConfidence && pending > 0

    return {
      intent,
      entities,
      slots,
      recommendations,
      overall,
      lowConfidence,
      needsClarification,
    }
  }

  /** Suggest which answered slot looks weakest for re-clarify (rarely used). */
  weakestSlot(slots: TravelPlanSlots, answered: TravelPlanSlotKey[]): TravelPlanSlotKey | null {
    if (!answered.length) return null
    // Prefer re-checking destination if present but intent was weak path.
    if (answered.includes('destination') && slots.destination) return 'destination'
    return answered[answered.length - 1] ?? null
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100))
}

export function createConfidenceEngine(): ConfidenceEngine {
  return new ConfidenceEngine()
}
