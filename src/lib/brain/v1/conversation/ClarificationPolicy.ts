/**
 * Sprint 85 — Clarification Policy (Value Before Questions).
 *
 * A) Blocking — may ask one direct question
 * B) High-impact — may ask one question AFTER useful value when possible
 * C) Optional — never blocks the first useful answer
 *
 * Default question budget: 1 (often 0).
 */

import type { TravelPlanSlotKey } from '../planning/types'
import type {
  ClarificationTier,
  ConversationQuestion,
  ConversationStage,
  ConversationValueItem,
} from './types'

export const DEFAULT_MAX_QUESTIONS_PER_TURN = 1

const TIER: Record<string, ClarificationTier> = {
  destination: 'blocking',
  dates: 'high_impact',
  flexibleDates: 'optional',
  origin: 'high_impact',
  adults: 'high_impact',
  children: 'high_impact',
  budget: 'high_impact',
  cabin: 'optional',
  hotelPreference: 'optional',
  transportation: 'optional',
  activities: 'optional',
  visa: 'optional',
  language: 'optional',
  currency: 'optional',
  specialRequests: 'optional',
  passport: 'blocking',
  payment_consent: 'blocking',
  traveler_identity: 'blocking',
}

/** Explore-stage priority after destination is known: departure city before dates. */
const EXPLORE_ASK_ORDER = [
  'origin',
  'adults',
  'dates',
  'budget',
  'children',
  'destination',
]

export class ClarificationPolicy {
  classify(field: string): ClarificationTier {
    return TIER[field] ?? 'optional'
  }

  decide(input: {
    missing: Array<TravelPlanSlotKey | string>
    answered: TravelPlanSlotKey[]
    assumedFields: string[]
    stage: ConversationStage
    hasValue: boolean
    valueItems: ConversationValueItem[]
    confidenceBand: 'high' | 'medium' | 'low_safe' | 'low_unsafe'
    forceBlockingQuestion?: boolean
    blockingQuestions?: ConversationQuestion[]
    toolMissingFields?: Array<{ field: string; tier: ClarificationTier; reason: string }>
    maxQuestionsPerTurn?: number
  }): {
    pending: Array<TravelPlanSlotKey | string>
    selectedSlot: TravelPlanSlotKey | string | null
    blockingQuestion: ConversationQuestion | null
    questionBudgetUsed: number
    skipReason: string | null
  } {
    const maxQ = input.maxQuestionsPerTurn ?? DEFAULT_MAX_QUESTIONS_PER_TURN
    const answered = new Set<string>(input.answered.map(String))
    const assumed = new Set(input.assumedFields)

    const pending = input.missing.filter((field) => {
      if (answered.has(String(field))) return false
      if (assumed.has(String(field))) return false
      if (field === 'dates' && assumed.has('flexibleDates') && input.stage === 'explore') {
        return false
      }
      if (field === 'adults' && assumed.has('adults')) return false
      return true
    })

    const askable = pending.filter((field) => {
      const tier = this.classify(String(field))
      if (tier === 'optional' && input.stage !== 'booking' && input.stage !== 'payment') {
        return false
      }
      return true
    })

    for (const toolField of input.toolMissingFields ?? []) {
      if (answered.has(toolField.field)) continue
      if (toolField.tier === 'optional') continue
      if (!askable.includes(toolField.field)) askable.push(toolField.field)
    }

    if (maxQ <= 0) {
      return {
        pending: askable,
        selectedSlot: null,
        blockingQuestion: null,
        questionBudgetUsed: 0,
        skipReason: 'question_budget_zero',
      }
    }

    const blockingQ = input.blockingQuestions?.find((q) => !answered.has(String(q.slot))) ?? null
    if (
      (input.forceBlockingQuestion || input.stage === 'booking' || input.stage === 'payment')
      && blockingQ
    ) {
      return {
        pending: askable,
        selectedSlot: String(blockingQ.slot),
        blockingQuestion: { ...blockingQ, tier: 'blocking' },
        questionBudgetUsed: 1,
        skipReason: null,
      }
    }

    const highImpact = askable.filter((f) => this.classify(String(f)) === 'high_impact')
    const blocking = askable.filter((f) => this.classify(String(f)) === 'blocking')

    if (input.confidenceBand === 'low_unsafe') {
      const slot = this.pickSlot(askable.length ? askable : blocking, input.stage)
      return {
        pending: askable,
        selectedSlot: slot,
        blockingQuestion: null,
        questionBudgetUsed: slot ? 1 : 0,
        skipReason: slot ? null : 'nothing_to_ask',
      }
    }

    if (blocking.includes('destination')) {
      return {
        pending: askable,
        selectedSlot: 'destination',
        blockingQuestion: null,
        questionBudgetUsed: 1,
        skipReason: null,
      }
    }

    // Value-first path: ask at most one high-impact after value.
    if (input.hasValue || input.valueItems.length > 0) {
      if (highImpact.length === 0) {
        return {
          pending: askable,
          selectedSlot: null,
          blockingQuestion: null,
          questionBudgetUsed: 0,
          skipReason: input.confidenceBand === 'high' ? 'value_sufficient' : 'no_high_impact_pending',
        }
      }
      const slot = this.pickSlot(highImpact, input.stage)
      return {
        pending: askable,
        selectedSlot: slot,
        blockingQuestion: null,
        questionBudgetUsed: slot ? 1 : 0,
        skipReason: null,
      }
    }

    if (highImpact.length > 0) {
      const slot = this.pickSlot(highImpact, input.stage)
      return {
        pending: askable,
        selectedSlot: slot,
        blockingQuestion: null,
        questionBudgetUsed: slot ? 1 : 0,
        skipReason: null,
      }
    }

    return {
      pending: askable,
      selectedSlot: null,
      blockingQuestion: null,
      questionBudgetUsed: 0,
      skipReason: 'nothing_to_ask',
    }
  }

  private pickSlot(
    fields: Array<TravelPlanSlotKey | string>,
    _stage: ConversationStage,
  ): TravelPlanSlotKey | string | null {
    if (!fields.length) return null
    for (const key of EXPLORE_ASK_ORDER) {
      if (fields.includes(key)) return key
    }
    return fields[0] ?? null
  }
}

export function createClarificationPolicy(): ClarificationPolicy {
  return new ClarificationPolicy()
}
