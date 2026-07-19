/**
 * Build passenger slots matching itinerary traveller counts.
 */

import type { TravellerCounts, Passenger, PassengerType } from './types'
import { emptyPassenger } from './types'

export function countsFromPlaceholder(
  placeholder: Partial<TravellerCounts> | null | undefined,
): TravellerCounts {
  const adults = Math.max(0, Number(placeholder?.adults ?? 0))
  const children = Math.max(0, Number(placeholder?.children ?? 0))
  const infants = Math.max(0, Number(placeholder?.infants ?? 0))
  const summed = adults + children + infants
  if (summed > 0) {
    return { adults, children, infants, total: summed }
  }
  const fallbackTotal = Math.max(0, Number(placeholder?.total ?? 0))
  if (fallbackTotal > 0) {
    return { adults: fallbackTotal, children: 0, infants: 0, total: fallbackTotal }
  }
  return { adults: 1, children: 0, infants: 0, total: 1 }
}

/** Normalize counts; default to one adult only when empty. */
export function normalizeTravellerCounts(counts: TravellerCounts): TravellerCounts {
  return countsFromPlaceholder(counts)
}

export function createPassengerSlots(counts: TravellerCounts): Passenger[] {
  const normalized = normalizeTravellerCounts(counts)
  const slots: Passenger[] = []
  const push = (type: PassengerType, n: number) => {
    for (let i = 0; i < n; i += 1) {
      slots.push(emptyPassenger(type, `pax_${type}_${i + 1}`))
    }
  }
  push('adult', normalized.adults)
  push('child', normalized.children)
  push('infant', normalized.infants)
  return slots
}

export function countPassengers(passengers: Passenger[]): TravellerCounts {
  const adults = passengers.filter((p) => p.type === 'adult').length
  const children = passengers.filter((p) => p.type === 'child').length
  const infants = passengers.filter((p) => p.type === 'infant').length
  return { adults, children, infants, total: adults + children + infants }
}

export function passengerSummaryLine(counts: TravellerCounts): string {
  return `adults:${counts.adults}|children:${counts.children}|infants:${counts.infants}|total:${counts.total}`
}
