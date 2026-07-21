import { clampScore, type ItineraryCandidate } from './candidate'
import type { ParsedOptimizerIntent } from './parseIntent'

export function scoreLuxury(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const flight = candidate.flight
  const hotel = candidate.hotel
  let score = 40

  if (flight.cabin === 'first') score += 28
  else if (flight.cabin === 'business') score += 20
  else if (flight.cabin === 'premium_economy') score += 8
  else score -= 8

  const stars = hotel.stars ?? 3
  score += stars * 10
  if ((hotel.rating ?? 0) >= 9) score += 8

  if (flight.stops === 0) score += 6
  if (intent.willingToPayMore || intent.priority === 'luxury') score += 8

  return clampScore(score)
}
