/**
 * Sprint 46 — Smart Clarification / Never-Ask-Twice engine.
 *
 * Soft preferences are inferred — never interrogated like a booking form.
 * Hard requirements (destination, dates/duration, budget, travelers) still block planning.
 */

import type { BudgetStyle, PackageScope, TripRequirements } from '../types'

/** Hard slots the consultant may still ask about. */
export const HARD_CLARIFICATION_FIELDS: Array<keyof TripRequirements> = [
  'destination',
  'durationDays',
  'budgetAmount',
  'travelers',
]

/** Soft slots — always inferred when unset; never form-asked. */
export const SOFT_CLARIFICATION_FIELDS: Array<keyof TripRequirements> = [
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
 * Fill soft preference slots with safe conversational defaults.
 * Never overwrites an explicit user/memory value.
 */
export function inferSoftRequirements(
  requirements: TripRequirements,
  options: { locale?: 'ar' | 'en' } = {},
): ClarificationInference {
  const next: TripRequirements = { ...requirements, interests: [...requirements.interests] }
  const inferred: Array<keyof TripRequirements> = []
  const rationale: string[] = []
  const locale = options.locale ?? 'ar'

  // Traveler type from party size (already partially done in merge — reinforce).
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
  }
  if (next.travelers == null && next.travelerType === 'couple') {
    next.travelers = 2
    inferred.push('travelers')
  }

  if (next.interests.length === 0) {
    next.interests = ['any']
    inferred.push('interests')
    rationale.push(locale === 'ar'
      ? 'لم تُحدد اهتمامات — سأبني خطة متوازنة'
      : 'No interests stated — using a balanced plan')
  }

  if (!next.weatherPreference) {
    next.weatherPreference = 'flexible'
    inferred.push('weatherPreference')
    rationale.push(locale === 'ar'
      ? 'الطقس مرن ما لم تُحدد خلاف ذلك'
      : 'Weather treated as flexible unless stated')
  }

  if (!next.budgetStyle) {
    next.budgetStyle = inferBudgetStyle(next)
    inferred.push('budgetStyle')
    rationale.push(locale === 'ar'
      ? `أسلوب الميزانية المستنتج: ${next.budgetStyle}`
      : `Inferred budget style: ${next.budgetStyle}`)
  }

  if (!next.hotelPreference) {
    next.hotelPreference = next.tripPurpose === 'business' ? 'central' : 'any'
    inferred.push('hotelPreference')
    rationale.push(locale === 'ar'
      ? `تفضيل الفندق المستنتج: ${next.hotelPreference}`
      : `Inferred hotel preference: ${next.hotelPreference}`)
  }

  if (!next.packageScope) {
    const scope: PackageScope = next.tripPurpose === 'business' ? 'flights_only' : 'full_package'
    next.packageScope = scope
    inferred.push('packageScope')
    rationale.push(locale === 'ar'
      ? `نطاق الباقة المستنتج: ${scope}`
      : `Inferred package scope: ${scope}`)
  }

  if (!next.tripPurpose) {
    if (next.travelerType === 'business') next.tripPurpose = 'business'
    else if (next.travelerType === 'family') next.tripPurpose = 'family'
    else if (next.travelerType === 'couple') next.tripPurpose = 'leisure'
  }

  return { requirements: next, inferred, rationale }
}

/**
 * Missing fields the AI is allowed to ask about.
 * Soft slots are never returned once smart clarification is active.
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
      if (req.durationDays == null && (!req.startDate || !req.endDate)) {
        missing.push('durationDays')
      }
      continue
    }
    if (field === 'budgetAmount') {
      if (req.budgetAmount == null && req.budgetFlexible !== true) missing.push('budgetAmount')
      continue
    }
    if (field === 'travelers') {
      if (req.travelers == null) missing.push('travelers')
    }
  }

  if (!smart) {
    // Legacy full intake — keep soft slots blocking (tests / flag off).
    for (const field of SOFT_CLARIFICATION_FIELDS) {
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

function inferBudgetStyle(requirements: TripRequirements): BudgetStyle {
  if (requirements.budgetFlexible) return 'midrange'
  const amount = requirements.budgetAmount
  if (amount == null) return 'midrange'
  const currency = (requirements.budgetCurrency || 'SAR').toUpperCase()
  const sar = toSar(amount, currency)
  const days = requirements.durationDays ?? 5
  const travelers = Math.max(1, requirements.travelers ?? 2)
  const perPersonPerDay = sar / (days * travelers)
  if (perPersonPerDay >= 1500) return 'luxury'
  if (perPersonPerDay <= 450) return 'budget'
  return 'midrange'
}

function toSar(amount: number, currency: string): number {
  const map: Record<string, number> = {
    SAR: 1,
    USD: 3.75,
    EUR: 4.1,
    GBP: 4.8,
    AED: 1.02,
  }
  return amount * (map[currency] ?? 1)
}
