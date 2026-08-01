/**
 * Sprint 84 — Plan Validator.
 * Detects missing required slots, conflicts, impossible dates,
 * invalid traveler counts, and budget conflicts.
 */

import type {
  TravelPlanSlots,
  TravelPlanValidationIssue,
  TravelPlanValidationResult,
} from './types'

export class PlanValidator {
  validate(slots: TravelPlanSlots, options?: {
    missingRequired?: Array<keyof TravelPlanSlots | 'dates' | 'adults' | 'origin' | 'destination'>
  }): TravelPlanValidationResult {
    const issues: TravelPlanValidationIssue[] = []

    for (const slot of options?.missingRequired ?? []) {
      issues.push({
        kind: 'missing_required',
        slot: slot as TravelPlanValidationIssue['slot'],
        detail: `Required slot missing: ${slot}`,
        severity: 'error',
      })
    }

    // Impossible dates: end before start.
    if (slots.dates.start && slots.dates.end) {
      if (slots.dates.end < slots.dates.start) {
        issues.push({
          kind: 'impossible_dates',
          slot: 'dates',
          detail: `End date ${slots.dates.end} is before start date ${slots.dates.start}`,
          severity: 'error',
        })
      }
    }

    // Invalid traveler counts.
    if (slots.adults != null && slots.adults < 1) {
      issues.push({
        kind: 'invalid_travelers',
        slot: 'adults',
        detail: 'Adults must be at least 1',
        severity: 'error',
      })
    }
    if (slots.children != null && slots.children < 0) {
      issues.push({
        kind: 'invalid_travelers',
        slot: 'children',
        detail: 'Children cannot be negative',
        severity: 'error',
      })
    }
    if (
      slots.adults != null
      && slots.children != null
      && slots.adults + slots.children > 9
    ) {
      issues.push({
        kind: 'invalid_travelers',
        slot: 'adults',
        detail: 'Traveler party exceeds supported maximum (9)',
        severity: 'warning',
      })
    }

    // Budget conflicts.
    if (slots.budget != null && slots.budget <= 0) {
      issues.push({
        kind: 'budget_conflict',
        slot: 'budget',
        detail: 'Budget must be greater than zero',
        severity: 'error',
      })
    }
    if (
      slots.budget != null
      && slots.budget < 200
      && slots.cabin === 'business'
    ) {
      issues.push({
        kind: 'budget_conflict',
        slot: 'budget',
        detail: 'Budget is likely insufficient for business cabin',
        severity: 'warning',
      })
    }

    // Origin/destination conflict.
    if (
      slots.origin
      && slots.destination
      && slots.origin.toLowerCase() === slots.destination.toLowerCase()
    ) {
      issues.push({
        kind: 'conflict',
        slot: 'origin',
        detail: 'Origin and destination are the same',
        severity: 'error',
      })
    }

    // Flexible + concrete conflict note (warning only).
    if (slots.flexibleDates && slots.dates.start) {
      issues.push({
        kind: 'conflict',
        slot: 'flexibleDates',
        detail: 'Both flexible dates and a concrete start date are set',
        severity: 'warning',
      })
    }

    const ok = !issues.some((i) => i.severity === 'error')
    return { ok, issues }
  }
}

export function createPlanValidator(): PlanValidator {
  return new PlanValidator()
}
