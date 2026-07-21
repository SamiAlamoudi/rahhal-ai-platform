/**
 * Sprint 72 — Flight search filters.
 */

import type { FlightCabinClass, FlightSearchFilters, UnifiedFlight } from './types'

function inTimeWindow(iso: string, from?: string, to?: string): boolean {
  if (!from && !to) return true
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return true
  if (from && t < Date.parse(from)) return false
  if (to && t > Date.parse(to)) return false
  return true
}

export function applyFlightFilters(
  flights: UnifiedFlight[],
  filters?: FlightSearchFilters,
): UnifiedFlight[] {
  if (!filters) return flights
  const cabins: FlightCabinClass[] | null = filters.cabin
    ? Array.isArray(filters.cabin)
      ? filters.cabin
      : [filters.cabin]
    : null

  return flights.filter((f) => {
    if (filters.minPrice != null && f.price < filters.minPrice) return false
    if (filters.maxPrice != null && f.price > filters.maxPrice) return false
    if (filters.airlines?.length) {
      const set = new Set(filters.airlines.map((a) => a.toLowerCase()))
      if (!set.has(f.airline.toLowerCase())) return false
    }
    if (filters.maxStops != null && f.stops > filters.maxStops) return false
    if (cabins && !cabins.includes(f.cabin)) return false
    if (!inTimeWindow(f.departureTime, filters.departureTimeFrom, filters.departureTimeTo)) {
      return false
    }
    if (!inTimeWindow(f.arrivalTime, filters.arrivalTimeFrom, filters.arrivalTimeTo)) {
      return false
    }
    if (filters.maxDurationMinutes != null && f.duration > filters.maxDurationMinutes) {
      return false
    }
    if (filters.refundableOnly && !f.refundable) return false
    if (filters.baggageIncluded && !f.baggage) return false
    return true
  })
}
