import { clampScore, type ItineraryCandidate } from './candidate'
import type { ParsedOptimizerIntent } from './parseIntent'

/** Convenience: walking, transfer, check-in/out sync, stops. */
export function scoreConvenience(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const flight = candidate.flight
  const hotel = candidate.hotel
  let score = 60

  if (flight.stops === 0) score += 14
  else if (flight.stops === 1) score -= 6
  else score -= 16

  const walk = hotel.walkMinutes
  if (walk != null) {
    if (walk <= 10) score += 16
    else if (walk <= 20) score += 8
    else if (walk <= 35) score += 0
    else score -= 14
  }

  // Airport transfer proxy: long walk or far hotel
  if (walk != null && walk > 40) score -= 10
  else if (walk != null && walk <= 15) score += 4

  // Check-in compatibility vs arrival
  const arrival = flight.arrivalHour
  const checkIn = hotel.checkInHour ?? 15
  if (arrival != null) {
    if (arrival >= checkIn) score += 10
    else if (arrival >= checkIn - 2) score += 4
    else score -= 12 // hotel mismatch / early arrival before check-in
  }

  // Check-out vs departure
  const departure = flight.departureHour
  const checkOut = hotel.checkOutHour ?? 12
  if (departure != null) {
    if (departure >= checkOut + 2) score += 6
    else if (departure < checkOut - 1) score -= 8
  }

  if (intent.minWalking) {
    if ((walk ?? 99) <= 12) score += 12
    else score -= 10
  }
  if (intent.priority === 'convenience') score += 5

  return clampScore(score)
}
