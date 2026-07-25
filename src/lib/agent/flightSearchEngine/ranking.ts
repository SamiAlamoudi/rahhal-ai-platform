/**
 * Sprint 72 — Flight ranking (price, duration, stops, airline, confidence, completeness).
 */

import type { UnifiedFlight } from './types'

export type RankPreferences = {
  preferredAirlines?: string[]
  /** Integration Sprint 2 — morning | afternoon | evening | night */
  preferredDepartureTime?: 'morning' | 'afternoon' | 'evening' | 'night'
}

function completenessScore(flight: UnifiedFlight): number {
  let score = 0
  if (flight.airline && flight.airline !== 'Unknown') score += 0.2
  if (flight.flightNumber) score += 0.15
  if (flight.departureTime) score += 0.15
  if (flight.arrivalTime) score += 0.15
  if (flight.baggage) score += 0.1
  if (flight.fareFamily) score += 0.1
  if (flight.bookingToken) score += 0.15
  return Math.min(1, score)
}

function providerConfidence(flight: UnifiedFlight): number {
  if (flight.provider === 'amadeus') return 0.95
  if (flight.provider === 'duffel') return 0.92
  if (flight.provider === 'booking') return 0.7
  return 0.6
}

export function scoreFlight(
  flight: UnifiedFlight,
  prefs: RankPreferences = {},
  cohort?: { minPrice: number; maxPrice: number; minDuration: number; maxDuration: number },
): number {
  const minPrice = cohort?.minPrice ?? flight.price
  const maxPrice = cohort?.maxPrice ?? flight.price
  const minDuration = cohort?.minDuration ?? flight.duration
  const maxDuration = cohort?.maxDuration ?? flight.duration

  const priceRange = Math.max(1, maxPrice - minPrice)
  const durationRange = Math.max(1, maxDuration - minDuration)

  const priceScore = 1 - (flight.price - minPrice) / priceRange
  const durationScore = 1 - (flight.duration - minDuration) / durationRange
  const stopsScore = flight.stops <= 0 ? 1 : flight.stops === 1 ? 0.6 : 0.25
  const preferred = (prefs.preferredAirlines ?? []).map((a) => a.toLowerCase())
  const airlineScore = preferred.length
    ? preferred.includes(flight.airline.toLowerCase())
      ? 1
      : 0.4
    : 0.7
  const confidence = providerConfidence(flight)
  const completeness = completenessScore(flight)
  let convenienceScore = flight.stops <= 0 ? 1 : flight.stops === 1 ? 0.65 : 0.35
  if (prefs.preferredDepartureTime && flight.departureTime) {
    const hour = new Date(flight.departureTime).getUTCHours()
    const window =
      hour >= 5 && hour < 12
        ? 'morning'
        : hour >= 12 && hour < 17
          ? 'afternoon'
          : hour >= 17 && hour < 21
            ? 'evening'
            : 'night'
    convenienceScore = (convenienceScore + (window === prefs.preferredDepartureTime ? 1 : 0.35)) / 2
  }

  return (
    priceScore * 0.28
    + durationScore * 0.18
    + stopsScore * 0.18
    + convenienceScore * 0.12
    + airlineScore * 0.1
    + confidence * 0.08
    + completeness * 0.06
  )
}

export function rankFlights(
  flights: UnifiedFlight[],
  prefs: RankPreferences = {},
): UnifiedFlight[] {
  if (flights.length === 0) return []
  const prices = flights.map((f) => f.price)
  const durations = flights.map((f) => f.duration)
  const cohort = {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
  }
  return flights
    .map((f) => ({ ...f, score: scoreFlight(f, prefs, cohort) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
