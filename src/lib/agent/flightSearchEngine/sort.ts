/**
 * Sprint 72 — Flight result sorting.
 */

import type { FlightSortMode, UnifiedFlight } from './types'

export function sortFlights(
  flights: UnifiedFlight[],
  mode: FlightSortMode = 'recommendation',
): UnifiedFlight[] {
  const copy = [...flights]
  switch (mode) {
    case 'lowest_price':
      return copy.sort((a, b) => a.price - b.price || a.duration - b.duration)
    case 'shortest_duration':
      return copy.sort((a, b) => a.duration - b.duration || a.price - b.price)
    case 'earliest_departure':
      return copy.sort(
        (a, b) => Date.parse(a.departureTime) - Date.parse(b.departureTime) || a.price - b.price,
      )
    case 'earliest_arrival':
      return copy.sort(
        (a, b) => Date.parse(a.arrivalTime) - Date.parse(b.arrivalTime) || a.price - b.price,
      )
    case 'recommendation':
    default:
      return copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.price - b.price)
  }
}
