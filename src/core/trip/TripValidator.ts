/**
 * Sprint 93 — unified trip validation.
 */

import type {
  TripFlight,
  TripHotel,
  TripPricingSummary,
  TripTimelineEvent,
  TripWarning,
} from './types'

export interface TripValidationResult {
  ok: boolean
  errors: string[]
  warnings: TripWarning[]
}

export function validateTrip(input: {
  flights: TripFlight[]
  hotel: TripHotel | null
  startDate: string | null
  endDate: string | null
  pricing: TripPricingSummary
  timeline: TripTimelineEvent[]
  currency: string
}): TripValidationResult {
  const errors: string[] = []
  const warnings: TripWarning[] = []

  if (input.flights.length === 0) {
    errors.push('Missing flights')
  }

  if (input.startDate && input.endDate) {
    const start = Date.parse(input.startDate)
    const end = Date.parse(input.endDate)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      errors.push('Invalid dates')
    } else if (end < start) {
      errors.push('Invalid dates')
    }
  } else if (input.startDate && !Date.parse(input.startDate)) {
    errors.push('Invalid dates')
  }

  if (input.pricing.total < 0
    || input.pricing.flightCost < 0
    || input.pricing.hotelCost < 0
    || input.pricing.transferCost < 0
    || input.pricing.activityCost < 0
    || input.pricing.insuranceCost < 0
    || input.pricing.visaCost < 0) {
    errors.push('Negative pricing')
  }

  const currencies = new Set<string>()
  currencies.add(input.currency.toUpperCase())
  for (const f of input.flights) currencies.add(f.currency.toUpperCase())
  if (input.hotel) currencies.add(input.hotel.currency.toUpperCase())
  if (currencies.size > 1) {
    errors.push('Currency mismatch')
  }

  const dated = input.timeline.filter((e) => e.at)
  for (let i = 1; i < dated.length; i++) {
    const prev = Date.parse(dated[i - 1]!.at!)
    const curr = Date.parse(dated[i]!.at!)
    if (Number.isFinite(prev) && Number.isFinite(curr) && curr + 60_000 < prev) {
      // Allow small clock skew; flag clearly inverted major steps.
      const prevKind = dated[i - 1]!.kind
      const currKind = dated[i]!.kind
      if (
        (prevKind === 'flight_return' && currKind === 'flight_outbound')
        || (prevKind === 'hotel_check_out' && currKind === 'hotel_check_in')
      ) {
        errors.push('Broken timeline')
        break
      }
    }
  }

  // Soft checks
  if (!input.hotel) {
    warnings.push({
      code: 'hotel_missing',
      message: 'No hotel selected — lodging may still be a placeholder.',
      severity: 'warning',
    })
  }
  if (input.pricing.budgetDelta != null && input.pricing.budgetDelta > 0) {
    warnings.push({
      code: 'over_budget',
      message: `Estimated total exceeds budget by ${input.pricing.budgetDelta} ${input.pricing.currency}.`,
      severity: 'warning',
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}
