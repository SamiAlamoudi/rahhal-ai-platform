/**
 * Sprint 46 — Smart Clarification / Never-Ask-Twice engine.
 *
 * Soft preferences are NOT form-filled with invented defaults.
 * Only high-confidence bridges from values the traveler already stated.
 * Hard requirements that block planning: destination, approx dates/duration, budget.
 */

import type { TripRequirements } from '../types'

/** Hard slots the consultant may still ask about (one at a time). */
export const HARD_CLARIFICATION_FIELDS: Array<keyof TripRequirements> = [
  'destination',
  'durationDays',
  'budgetAmount',
]

/** Soft slots — never form-asked when smart clarification is on; left null until stated. */
export const SOFT_CLARIFICATION_FIELDS: Array<keyof TripRequirements> = [
  'travelers',
  'travelerType',
  'interests',
  'weatherPreference',
  'budgetStyle',
  'hotelPreference',
  'packageScope',
]

export interface ClarificationInference {
  requirements: TripRequirements
  inferred: Array<keyof TripRequirements>
  rationale: string[]
}

/**
 * True when the traveler has given enough timing signal to plan
 * (explicit duration and/or approximate start / date window).
 */
export function hasApproximateTravelDates(requirements: TripRequirements): boolean {
  if (requirements.durationDays != null) return true
  if (requirements.startDate) return true
  return false
}

/**
 * High-confidence bridges only. Never invent party size, hotel, style, purpose, etc.
 * Missing information stays null / empty so the consultant can ask or proceed honestly.
 */
export function inferSoftRequirements(
  requirements: TripRequirements,
  options: { locale?: 'ar' | 'en' } = {},
): ClarificationInference {
  const next: TripRequirements = { ...requirements, interests: [...requirements.interests] }
  const inferred: Array<keyof TripRequirements> = []
  const rationale: string[] = []
  const locale = options.locale ?? 'ar'

  // High confidence: party size ↔ traveler type when one side is already explicit.
  if (next.travelerType == null && next.travelers != null) {
    if (next.travelers === 1) next.travelerType = 'solo'
    else if (next.travelers === 2) next.travelerType = 'couple'
    else next.travelerType = 'family'
    inferred.push('travelerType')
    rationale.push(locale === 'ar'
      ? `استنتجت نوع المسافرين من العدد (${next.travelers})`
      : `Inferred traveler type from party size (${next.travelers})`)
  }
  if (next.travelers == null && next.travelerType === 'solo') {
    next.travelers = 1
    inferred.push('travelers')
    rationale.push(locale === 'ar' ? 'فردي → مسافر واحد' : 'Solo → 1 traveler')
  }
  if (next.travelers == null && next.travelerType === 'couple') {
    next.travelers = 2
    inferred.push('travelers')
    rationale.push(locale === 'ar' ? 'زوجان → مسافران' : 'Couple → 2 travelers')
  }

  // High confidence: closed date window → duration in days.
  if (
    next.durationDays == null
    && next.startDate
    && next.endDate
  ) {
    const start = Date.parse(next.startDate)
    const end = Date.parse(next.endDate)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1)
      next.durationDays = days
      inferred.push('durationDays')
      rationale.push(locale === 'ar'
        ? `استنتجت المدة (${days} أيام) من فترة السفر`
        : `Inferred duration (${days} days) from the travel window`)
    }
  }

  return { requirements: next, inferred, rationale }
}

/**
 * Missing fields the AI is allowed to ask about.
 * Soft slots are never returned once smart clarification is active.
 * Inspect known state first — never re-ask filled slots.
 */
export function missingClarificationFields(
  requirements: TripRequirements,
  options: { smart?: boolean } = {},
): Array<keyof TripRequirements> {
  const smart = options.smart !== false
  const req = requirements
  const missing: Array<keyof TripRequirements> = []

  for (const field of HARD_CLARIFICATION_FIELDS) {
    if (field === 'destination') {
      if (req.destinationFlexible) continue
      if (!req.destination && req.destinations.length === 0) missing.push('destination')
      continue
    }
    if (field === 'durationDays') {
      // Approx dates (startDate and/or duration) satisfy timing — never re-ask.
      if (!hasApproximateTravelDates(req)) {
        missing.push('durationDays')
      }
      continue
    }
    if (field === 'budgetAmount') {
      if (req.budgetAmount == null && req.budgetFlexible !== true) missing.push('budgetAmount')
      continue
    }
  }

  if (!smart) {
    // Legacy full intake — keep soft slots blocking (tests / flag off).
    for (const field of SOFT_CLARIFICATION_FIELDS) {
      if (field === 'travelers' && req.travelers == null) missing.push('travelers')
      if (field === 'travelerType' && req.travelerType == null) missing.push('travelerType')
      if (field === 'interests' && req.interests.length === 0) missing.push('interests')
      if (field === 'weatherPreference' && !req.weatherPreference) missing.push('weatherPreference')
      if (field === 'budgetStyle' && !req.budgetStyle) missing.push('budgetStyle')
      if (field === 'hotelPreference' && !req.hotelPreference) missing.push('hotelPreference')
      if (field === 'packageScope' && !req.packageScope) missing.push('packageScope')
    }
  }

  return missing
}
