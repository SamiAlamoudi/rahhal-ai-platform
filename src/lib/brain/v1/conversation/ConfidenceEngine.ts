/**
 * Sprint 85 — Confidence Engine (Value Before Questions).
 *
 * High → answer directly
 * Medium → answer with disclosed assumptions + optional one question
 * Low+safe → bounded preliminary value + one question
 * Low+unsafe → one blocking question (no fabricated certainty)
 *
 * Low confidence does NOT automatically force a questionnaire.
 */

import type { BrainV1IntentResult } from '../types'
import type { TravelPlanSlotKey, TravelPlanSlots } from '../planning/types'
import type { ConfidenceBand, ConversationConfidence } from './types'

export class ConfidenceEngine {
  evaluate(input: {
    intent: BrainV1IntentResult
    slots: TravelPlanSlots
    completedSlots: TravelPlanSlotKey[]
    pendingSlots: Array<TravelPlanSlotKey | string>
    recommendations?: string[]
    ambiguousText?: boolean
    hasDestination?: boolean
    unsafe?: boolean
  }): ConversationConfidence {
    const intent = clamp(input.intent.confidence)
    const filled = input.completedSlots.length
    const pending = input.pendingSlots.length
    const slotRatio = filled + pending === 0 ? 0.45 : filled / (filled + Math.max(1, pending))
    const slots = clamp(slotRatio)

    let entities = 0.35
    if (input.slots.destination || input.hasDestination) entities += 0.3
    if (input.slots.dates.start || input.slots.flexibleDates) entities += 0.15
    if (input.slots.origin) entities += 0.1
    if (input.slots.adults != null) entities += 0.1
    if (input.ambiguousText) entities -= 0.15
    entities = clamp(entities)

    const recommendations = input.recommendations?.length
      ? clamp(0.55 + Math.min(0.35, input.recommendations.length * 0.12))
      : input.slots.destination
        ? 0.55
        : 0.35

    const overall = clamp(intent * 0.28 + entities * 0.34 + slots * 0.2 + recommendations * 0.18)
    const lowConfidence = overall < 0.55
    const band = this.band(overall, Boolean(input.unsafe), Boolean(input.slots.destination || input.hasDestination))

    return {
      intent,
      entities,
      slots,
      recommendations,
      overall,
      band,
      lowConfidence,
      mayAskClarification: band === 'medium' || band === 'low_safe' || band === 'low_unsafe',
      forceBlockingQuestion: band === 'low_unsafe',
    }
  }

  private band(overall: number, unsafe: boolean, hasDest: boolean): ConfidenceBand {
    if (unsafe || (!hasDest && overall < 0.5)) return 'low_unsafe'
    if (overall >= 0.75) return 'high'
    if (overall >= 0.55) return 'medium'
    return 'low_safe'
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100))
}

export function createConfidenceEngine(): ConfidenceEngine {
  return new ConfidenceEngine()
}
