import { clampScore, type ItineraryCandidate } from './candidate'
import type { ParsedOptimizerIntent } from './parseIntent'

/** Travel time: duration, layover quality, total journey. */
export function scoreTravelTime(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const flight = candidate.flight
  let score = 70
  const duration = flight.durationMinutes

  if (duration != null) {
    if (duration <= 180) score += 20
    else if (duration <= 360) score += 10
    else if (duration <= 600) score += 0
    else if (duration <= 900) score -= 12
    else score -= 22
  }

  const layover = flight.layoverMinutes
  if (layover != null) {
    if (layover > 0 && layover < 60) score -= 14 // tight connection risk
    else if (layover >= 60 && layover <= 150) score += 8
    else if (layover > 150 && layover <= 240) score -= 4
    else if (layover > 240) score -= 18 // long layover
  }

  if (flight.stops === 0) score += 10
  else if (flight.stops >= 2) score -= 14

  if (intent.priority === 'speed') score += 8
  if (intent.earlyMeeting && (flight.arrivalHour ?? 12) > 10) score -= 10

  return clampScore(score)
}
