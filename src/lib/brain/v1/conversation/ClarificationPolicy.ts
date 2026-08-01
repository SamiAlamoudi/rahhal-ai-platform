/**
 * Sprint 85 — Clarification Policy.
 * Ask one question only. Never repeat answered questions. Never ask unnecessary ones.
 */

import type { TravelPlanSlotKey } from '../planning/types'
import type { ConversationQuestion } from './types'

export class ClarificationPolicy {
  /**
   * Filter candidate missing slots against already-answered slots,
   * then keep at most one question.
   */
  apply(input: {
    missing: TravelPlanSlotKey[]
    answered: TravelPlanSlotKey[]
    question: ConversationQuestion | null
    lowConfidence?: boolean
    lowConfidenceSlot?: TravelPlanSlotKey | null
  }): { pending: TravelPlanSlotKey[]; question: ConversationQuestion | null } {
    const answered = new Set(input.answered)
    const pending = input.missing.filter((slot) => !answered.has(slot))

    // Low-confidence clarification may re-ask a single answered slot once.
    if (input.lowConfidence && input.lowConfidenceSlot && input.question) {
      return {
        pending: pending.includes(input.lowConfidenceSlot)
          ? pending
          : [input.lowConfidenceSlot, ...pending],
        question: input.question.slot === input.lowConfidenceSlot
          ? input.question
          : input.question,
      }
    }

    if (!input.question) return { pending, question: null }
    if (answered.has(input.question.slot)) {
      return { pending, question: null }
    }
    if (!pending.includes(input.question.slot) && pending[0]) {
      // Question must target a still-pending slot.
      return { pending, question: null }
    }
    return { pending, question: input.question }
  }

  /** True when asking would be unnecessary (nothing pending). */
  shouldAsk(pending: TravelPlanSlotKey[]): boolean {
    return pending.length > 0
  }
}

export function createClarificationPolicy(): ClarificationPolicy {
  return new ClarificationPolicy()
}
