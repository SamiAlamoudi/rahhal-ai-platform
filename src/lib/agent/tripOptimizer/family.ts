import { clampScore, type ItineraryCandidate } from './candidate'
import type { ParsedOptimizerIntent } from './parseIntent'

export function scoreFamily(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const flight = candidate.flight
  const hotel = candidate.hotel
  let score = 50

  if (hotel.familyFriendly) score += 18
  if ((hotel.stars ?? 0) >= 4) score += 8
  if (flight.stops === 0) score += 12
  else if (flight.stops >= 2) score -= 14

  const layover = flight.layoverMinutes ?? 0
  if (layover > 180) score -= 12

  const arrival = flight.arrivalHour
  if (arrival != null && (arrival >= 22 || arrival <= 5)) score -= 16

  if ((hotel.walkMinutes ?? 30) <= 15) score += 8

  if (intent.hasChildren || intent.priority === 'family') {
    score += 8
    if (!hotel.familyFriendly) score -= 10
  }

  return clampScore(score)
}
