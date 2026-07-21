import { clampScore, type ItineraryCandidate } from './candidate'
import type { ParsedOptimizerIntent } from './parseIntent'

export function scoreBusiness(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const flight = candidate.flight
  const hotel = candidate.hotel
  let score = 52

  if (hotel.businessFriendly) score += 16
  if (flight.cabin === 'business' || flight.cabin === 'first') score += 14
  else if (flight.cabin === 'premium_economy') score += 6

  if (flight.stops === 0) score += 12
  else score -= 8

  const arrival = flight.arrivalHour
  if (intent.earlyMeeting) {
    if (arrival != null && arrival <= 9) score += 18
    else if (arrival != null && arrival <= 12) score += 6
    else score -= 20
  } else if (arrival != null && arrival >= 8 && arrival <= 16) {
    score += 8
  }

  if ((hotel.walkMinutes ?? 40) <= 15) score += 8
  if (intent.priority === 'business') score += 6

  return clampScore(score)
}
