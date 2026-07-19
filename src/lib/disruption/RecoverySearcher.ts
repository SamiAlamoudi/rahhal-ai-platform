/**
 * Sprint 37 — RecoverySearcher
 * Generates alternative flight/hotel/car/activity/transport/route options.
 * Deterministic sandbox search — does not rewrite planner/provider stacks.
 */

import type {
  DetectedDisruption,
  DisruptionContext,
  RecoveryOption,
  RecoveryOptionKind,
} from './types'

export class RecoverySearcher {
  search(
    disruption: DetectedDisruption,
    context: DisruptionContext,
  ): RecoveryOption[] {
    const options: RecoveryOption[] = []
    const currency = context.currency || 'SAR'

    if (needsFlight(disruption)) {
      options.push(
        option({
          kind: 'alternative_flight',
          title: `Next available flight to ${context.destination}`,
          description: 'Same cabin, arrives earlier than waiting on original delay',
          providerId: context.preferredAirlines?.[0] ?? 'mock-flight-recovery',
          extraCost: disruption.eventType === 'flight_cancelled' ? 350 : 0,
          currency,
          delayReductionMinutes: Math.max(60, disruption.delayMinutes - 45),
          arrivalDeltaMinutes: -Math.max(30, disruption.delayMinutes - 60),
          confidence: 0.86,
          reasons: ['Earliest workable departure', 'Matches origin/destination'],
          metadata: { cabinClass: context.cabinClass ?? 'economy' },
        }),
      )
      options.push(
        option({
          kind: 'alternative_route',
          title: `Alternate route via hub to ${context.destination}`,
          description: 'One-stop recovery routing to protect arrival day',
          providerId: 'mock-route-recovery',
          extraCost: 180,
          currency,
          delayReductionMinutes: Math.max(90, disruption.delayMinutes - 30),
          arrivalDeltaMinutes: -90,
          confidence: 0.78,
          reasons: ['Protects same-day arrival', 'Uses available inventory'],
          metadata: { stops: 1 },
        }),
      )
    }

    if (needsHotel(disruption, context)) {
      const stars = context.hotelStars ?? 4
      options.push(
        option({
          kind: 'alternative_hotel',
          title: `${stars}★ hotel alternative in ${context.destination}`,
          description: context.hotelName
            ? `Replacement near ${context.hotelName}`
            : 'Comparable hotel with free cancellation buffer',
          providerId: context.preferredHotels?.[0] ?? 'hotelbeds',
          extraCost: disruption.eventType.includes('hotel') ? 120 : 0,
          currency,
          delayReductionMinutes: 0,
          arrivalDeltaMinutes: 0,
          confidence: 0.84,
          reasons: ['Similar rating', 'Available for shifted dates'],
          metadata: { stars, freeCancellation: true },
        }),
      )
    }

    if (needsCar(disruption)) {
      options.push(
        option({
          kind: 'alternative_car',
          title: 'Replacement rental car',
          description: 'Same class vehicle at nearby desk',
          providerId: 'car_generic',
          extraCost: 40,
          currency,
          delayReductionMinutes: 30,
          arrivalDeltaMinutes: 0,
          confidence: 0.8,
          reasons: ['Pickup still possible today'],
          metadata: {},
        }),
      )
    }

    if (needsActivity(disruption)) {
      options.push(
        option({
          kind: 'alternative_activity',
          title: 'Rescheduled activity slot',
          description: 'Same experience moved to next available window',
          providerId: 'activity_generic',
          extraCost: 0,
          currency,
          delayReductionMinutes: 0,
          arrivalDeltaMinutes: 1440,
          confidence: 0.9,
          reasons: ['Provider confirmed next-day inventory'],
          metadata: { shiftedDays: 1 },
        }),
      )
    }

    if (needsTransport(disruption)) {
      options.push(
        option({
          kind: 'alternative_transport',
          title: 'Updated airport transfer',
          description: 'Transfer retimed to new arrival',
          providerId: 'transport_generic',
          extraCost: 0,
          currency,
          delayReductionMinutes: 0,
          arrivalDeltaMinutes: disruption.delayMinutes,
          confidence: 0.92,
          reasons: ['Aligned to new landing time'],
          metadata: {},
        }),
      )
    }

    return options
  }
}

export function createRecoverySearcher(): RecoverySearcher {
  return new RecoverySearcher()
}

function needsFlight(d: DetectedDisruption): boolean {
  return d.affectedServices.includes('flight')
    || ['flight_delayed', 'flight_cancelled', 'missed_connection', 'schedule_changed', 'airport_closure', 'strike', 'weather_disruption'].includes(d.eventType)
}

function needsHotel(d: DetectedDisruption, ctx: DisruptionContext): boolean {
  return d.affectedServices.includes('hotel')
    || d.delayMinutes >= 180
    || Boolean(ctx.hotelName)
    || d.eventType.startsWith('hotel_')
}

function needsCar(d: DetectedDisruption): boolean {
  return d.eventType === 'car_unavailable' || d.affectedServices.includes('car')
}

function needsActivity(d: DetectedDisruption): boolean {
  return d.eventType === 'activity_cancelled'
    || d.affectedServices.includes('activity')
    || d.delayMinutes >= 120
}

function needsTransport(d: DetectedDisruption): boolean {
  return d.affectedServices.includes('transport')
    || d.delayMinutes >= 60
    || d.eventType === 'flight_delayed'
    || d.eventType === 'flight_cancelled'
}

function option(input: {
  kind: RecoveryOptionKind
  title: string
  description: string
  providerId: string
  extraCost: number
  currency: string
  delayReductionMinutes: number
  arrivalDeltaMinutes: number
  confidence: number
  reasons: string[]
  metadata: Record<string, unknown>
}): RecoveryOption {
  return {
    optionId: `ro_${Math.random().toString(36).slice(2, 9)}`,
    kind: input.kind,
    title: input.title,
    description: input.description,
    providerId: input.providerId,
    extraCost: input.extraCost,
    currency: input.currency,
    delayReductionMinutes: input.delayReductionMinutes,
    arrivalDeltaMinutes: input.arrivalDeltaMinutes,
    confidence: input.confidence,
    factors: {
      cost: 1 - Math.min(1, input.extraCost / 500),
      speed: Math.min(1, input.delayReductionMinutes / 300),
      confidence: input.confidence,
    },
    reasons: input.reasons,
    metadata: input.metadata,
  }
}
