/**
 * Highest-priority missing field for TripState — one question at a time.
 */

import { isBroadCountry } from './geography'
import type { TripMissingField, TripState } from './types'

/** Priority order for consultant questions (never stack). */
export const TRIP_MISSING_PRIORITY: TripMissingField[] = [
  'destinationCountry',
  'destinationCity',
  'duration',
  'travelDates',
  'budget',
  'travelStyle',
  'travelers',
]

export function computeMissingFields(state: Pick<
  TripState,
  | 'destinationCountry'
  | 'destinationCity'
  | 'duration'
  | 'travelDates'
  | 'budget'
  | 'travelStyle'
  | 'travelers'
  | 'relationship'
>): TripMissingField[] {
  const missing: TripMissingField[] = []

  if (!state.destinationCountry && !state.destinationCity) {
    missing.push('destinationCountry')
  } else if (
    state.destinationCountry
    && isBroadCountry(state.destinationCountry)
    && !state.destinationCity
  ) {
    missing.push('destinationCity')
  }

  const hasTiming = state.duration != null
    || Boolean(state.travelDates.start)
    || Boolean(state.travelDates.end)
  if (!hasTiming) missing.push('duration')

  if (state.budget == null) missing.push('budget')

  if (!state.travelStyle) missing.push('travelStyle')

  // Travelers are soft — only ask when nothing else is missing and party unknown.
  if (
    missing.length === 0
    && state.travelers == null
    && state.relationship == null
  ) {
    missing.push('travelers')
  }

  return missing
}

export function primaryMissingField(missing: TripMissingField[]): TripMissingField | null {
  for (const field of TRIP_MISSING_PRIORITY) {
    if (missing.includes(field)) return field
  }
  return missing[0] ?? null
}

/**
 * Hard slots that must be filled before agent itinerary / inventory execution.
 * travelStyle / travelers remain conversational (and gate cards) but do not block plans
 * once classic hard intake is complete.
 */
export const TRIP_EXECUTE_BLOCKERS: TripMissingField[] = [
  'destinationCountry',
  'destinationCity',
  'duration',
  'travelDates',
  'budget',
]

export function isTripExecuteBlocked(primaryMissing: TripMissingField | null): boolean {
  if (!primaryMissing) return false
  return TRIP_EXECUTE_BLOCKERS.includes(primaryMissing)
}
