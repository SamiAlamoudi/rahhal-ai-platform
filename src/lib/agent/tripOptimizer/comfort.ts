import { clampScore, type ItineraryCandidate } from './candidate'
import type { ParsedOptimizerIntent } from './parseIntent'

/** Comfort: cabin, sleep quality, late arrival penalty, jet lag. */
export function scoreComfort(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const flight = candidate.flight
  const hotel = candidate.hotel
  let score = 55

  if (flight.cabin === 'first') score += 22
  else if (flight.cabin === 'business') score += 18
  else if (flight.cabin === 'premium_economy') score += 10
  else score -= 4

  const stars = hotel.stars ?? 3
  score += (stars - 3) * 8
  if ((hotel.rating ?? 7) >= 8.5) score += 6

  const arrival = flight.arrivalHour
  if (arrival != null) {
    if (arrival >= 22 || arrival <= 5) score -= 18 // late / red-eye hurts sleep
    else if (arrival >= 9 && arrival <= 18) score += 8
  }

  // Jet lag heuristic: long haul + late arrival
  const duration = flight.durationMinutes ?? 0
  if (duration >= 600 && arrival != null && (arrival >= 22 || arrival <= 6)) score -= 12
  else if (duration >= 600) score -= 4

  if ((flight.layoverMinutes ?? 0) >= 240) score -= 10
  if (intent.priority === 'comfort') score += 6

  return clampScore(score)
}
