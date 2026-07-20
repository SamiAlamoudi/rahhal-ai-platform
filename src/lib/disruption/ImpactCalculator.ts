/**
 * Sprint 37 — passenger impact calculator.
 */

import type { DetectedDisruption, DisruptionContext, PassengerImpact } from './types'

export class ImpactCalculator {
  calculate(disruption: DetectedDisruption, context: DisruptionContext): PassengerImpact {
    const travelersAffected = Math.max(1, Number(context.conversationNotes?.length ? 2 : 2))
    const overnightRequired =
      disruption.delayMinutes >= 360
      || disruption.eventType === 'flight_cancelled'
      || disruption.eventType === 'missed_connection'
      || disruption.eventType === 'airport_closure'

    const connectionAtRisk =
      disruption.eventType === 'missed_connection'
      || disruption.eventType === 'flight_delayed' && disruption.delayMinutes >= 90

    const hotelSameDayImpact =
      overnightRequired
      || disruption.affectedServices.includes('hotel')
      || disruption.delayMinutes >= 180

    const activitiesImpacted =
      disruption.affectedServices.includes('activity')
        ? disruption.delayMinutes >= 120
          ? 2
          : 1
        : disruption.delayMinutes >= 240
          ? 1
          : 0

    const transportImpacted =
      disruption.affectedServices.includes('transport')
      || disruption.delayMinutes >= 60

    const stressScore = clamp01(
      (severityWeight(disruption.severity) * 0.45)
        + Math.min(1, disruption.delayMinutes / 480) * 0.35
        + (overnightRequired ? 0.15 : 0)
        + (connectionAtRisk ? 0.1 : 0),
    )

    const summary = [
      `${travelersAffected} traveler(s) affected`,
      overnightRequired ? 'overnight rebooking likely' : null,
      connectionAtRisk ? 'connection at risk' : null,
      hotelSameDayImpact ? 'hotel check-in may shift' : null,
      activitiesImpacted > 0 ? `${activitiesImpacted} activity(ies) impacted` : null,
    ]
      .filter(Boolean)
      .join('; ')

    return {
      travelersAffected,
      overnightRequired,
      connectionAtRisk,
      hotelSameDayImpact,
      activitiesImpacted,
      transportImpacted,
      stressScore,
      summary,
    }
  }
}

export function createImpactCalculator(): ImpactCalculator {
  return new ImpactCalculator()
}

function severityWeight(severity: DetectedDisruption['severity']): number {
  switch (severity) {
    case 'low':
      return 0.25
    case 'medium':
      return 0.5
    case 'high':
      return 0.8
    case 'critical':
      return 1
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
