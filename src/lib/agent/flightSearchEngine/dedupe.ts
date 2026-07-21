/**
 * Sprint 72 — Deduplicate itineraries across providers; keep highest confidence.
 */

import type { UnifiedFlight } from './types'

function itineraryKey(flight: UnifiedFlight): string {
  const dep = flight.departureTime.slice(0, 16)
  const arr = flight.arrivalTime.slice(0, 16)
  return [
    flight.origin,
    flight.destination,
    dep,
    arr,
    flight.airline.toLowerCase(),
    flight.stops,
    flight.cabin,
  ].join('|')
}

function confidence(flight: UnifiedFlight): number {
  if (typeof flight.score === 'number') return flight.score
  if (flight.provider === 'amadeus') return 0.95
  if (flight.provider === 'duffel') return 0.92
  if (flight.provider === 'booking') return 0.7
  return 0.55
}

export function dedupeFlights(flights: UnifiedFlight[]): UnifiedFlight[] {
  const best = new Map<string, UnifiedFlight>()
  for (const flight of flights) {
    const key = itineraryKey(flight)
    const existing = best.get(key)
    if (!existing || confidence(flight) > confidence(existing)) {
      best.set(key, flight)
    } else if (
      confidence(flight) === confidence(existing)
      && flight.price < existing.price
    ) {
      best.set(key, flight)
    }
  }
  return [...best.values()]
}
