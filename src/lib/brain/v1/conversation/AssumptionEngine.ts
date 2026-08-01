/**
 * Sprint 85 — Assumption Engine (Value Before Questions).
 * Safe, reversible assumptions — never override explicit user statements.
 * Never assume sensitive/legal/identity/payment/visa/health/accessibility facts.
 */

import type { TravelPlanSlotKey, TravelPlanSlots } from '../planning/types'
import type { ConversationAssumption } from './types'

const SENSITIVE_FIELDS = new Set([
  'passport',
  'visa',
  'nationality',
  'payment',
  'identity',
  'health',
  'accessibility',
  'consent',
])

export class AssumptionEngine {
  /**
   * Build assumptions for missing non-sensitive fields.
   * Explicit slot values are never overridden.
   */
  infer(input: {
    slots: TravelPlanSlots
    answered: TravelPlanSlotKey[]
    priorAssumptions?: ConversationAssumption[]
  }): ConversationAssumption[] {
    const answered = new Set(input.answered)
    const next: ConversationAssumption[] = []

    const keepPrior = (input.priorAssumptions ?? []).filter((a) => {
      if (SENSITIVE_FIELDS.has(a.field)) return false
      // Drop priors that user has now confirmed/changed.
      if (a.field === 'adults' && answered.has('adults')) return false
      if (a.field === 'flexibleDates' && (answered.has('dates') || answered.has('flexibleDates'))) {
        return false
      }
      if (a.field === 'cabin' && answered.has('cabin')) return false
      if (a.field === 'budgetMode' && answered.has('budget')) return false
      if (a.field === 'hotelCategory' && answered.has('hotelPreference')) return false
      if (a.field === 'tripType') return true
      return true
    })

    const has = (field: string) => keepPrior.some((a) => a.field === field) || next.some((a) => a.field === field)

    if (!answered.has('adults') && input.slots.adults == null && !has('adults')) {
      next.push({
        field: 'adults',
        assumedValue: 1,
        reason: 'Default single leisure traveler until told otherwise',
        confidence: 0.62,
        reversible: true,
        requiresConfirmationBeforeBooking: true,
        source: 'assumption_engine',
      })
    }

    if (
      !answered.has('dates')
      && !answered.has('flexibleDates')
      && !input.slots.dates.start
      && input.slots.flexibleDates == null
      && !has('flexibleDates')
    ) {
      next.push({
        field: 'flexibleDates',
        assumedValue: true,
        reason: 'No dates given — treat timing as flexible for preliminary planning',
        confidence: 0.7,
        reversible: true,
        requiresConfirmationBeforeBooking: true,
        source: 'assumption_engine',
      })
    }

    if (!answered.has('cabin') && !input.slots.cabin && !has('cabin')) {
      next.push({
        field: 'cabin',
        assumedValue: 'economy',
        reason: 'Economy is the default reversible cabin assumption',
        confidence: 0.68,
        reversible: true,
        requiresConfirmationBeforeBooking: true,
        source: 'assumption_engine',
      })
    }

    if (!answered.has('budget') && input.slots.budget == null && !has('budgetMode')) {
      next.push({
        field: 'budgetMode',
        assumedValue: 'balanced',
        reason: 'Mid-range / balanced budget for preliminary options',
        confidence: 0.6,
        reversible: true,
        requiresConfirmationBeforeBooking: true,
        source: 'assumption_engine',
      })
    }

    if (!answered.has('hotelPreference') && !input.slots.hotelPreference && !has('hotelCategory')) {
      next.push({
        field: 'hotelCategory',
        assumedValue: 'mid-range',
        reason: 'Mid-range stays are a safe preliminary default',
        confidence: 0.58,
        reversible: true,
        requiresConfirmationBeforeBooking: true,
        source: 'assumption_engine',
      })
    }

    if (!has('tripType')) {
      next.push({
        field: 'tripType',
        assumedValue: 'leisure',
        reason: 'Leisure is the default trip type for open destination requests',
        confidence: 0.65,
        reversible: true,
        requiresConfirmationBeforeBooking: false,
        source: 'assumption_engine',
      })
    }

    // Merge: prior (filtered) + new, unique by field (new wins).
    const byField = new Map<string, ConversationAssumption>()
    for (const a of keepPrior) byField.set(a.field, a)
    for (const a of next) byField.set(a.field, a)
    return [...byField.values()]
  }

  /** Apply reversible assumptions onto a working slot view (does not mark confirmed). */
  applyToSlots(slots: TravelPlanSlots, assumptions: ConversationAssumption[]): TravelPlanSlots {
    const working: TravelPlanSlots = {
      ...slots,
      dates: { ...slots.dates },
      activities: [...slots.activities],
    }
    for (const a of assumptions) {
      if (a.field === 'adults' && working.adults == null && typeof a.assumedValue === 'number') {
        working.adults = a.assumedValue
      }
      if (a.field === 'flexibleDates' && working.flexibleDates == null && working.dates.start == null) {
        working.flexibleDates = Boolean(a.assumedValue)
      }
      if (a.field === 'cabin' && !working.cabin && typeof a.assumedValue === 'string') {
        working.cabin = a.assumedValue
      }
      if (a.field === 'hotelCategory' && !working.hotelPreference && typeof a.assumedValue === 'string') {
        working.hotelPreference = a.assumedValue
      }
    }
    return working
  }

  /** Replace an assumption when the user provides an explicit correction. */
  revise(
    assumptions: ConversationAssumption[],
    field: string,
    _explicitValue: string | number | boolean,
  ): ConversationAssumption[] {
    // Explicit values become confirmed slots — assumption removed.
    return assumptions.filter((a) => a.field !== field)
  }
}

export function createAssumptionEngine(): AssumptionEngine {
  return new AssumptionEngine()
}
