import type { TravelDraft } from '../travel/types'

export type PlanStep = {
  id: string
  kind: 'flight' | 'hotel' | 'activity' | 'transfer' | 'buffer'
  title: string
  dayOffset: number
}

export type TripPlanSkeleton = {
  destination?: string
  nights: number
  steps: PlanStep[]
  assumptions: string[]
}

/**
 * Builds a mock itinerary skeleton from draft — no provider calls.
 */
export class TripPlanner {
  plan(draft: TravelDraft): TripPlanSkeleton {
    const nights = draft.durationNights ?? 3
    const assumptions: string[] = []
    if (!draft.durationNights) assumptions.push('Assumed 3 nights (mock default).')
    if (!draft.origin) assumptions.push('Origin pending.')

    const steps: PlanStep[] = [
      {
        id: 'step-flight-out',
        kind: 'flight',
        title: draft.origin
          ? `Outbound ${draft.origin} → ${draft.destination ?? 'TBD'}`
          : 'Outbound flight',
        dayOffset: 0,
      },
      {
        id: 'step-hotel',
        kind: 'hotel',
        title: draft.destination ? `Stay in ${draft.destination}` : 'Hotel stay',
        dayOffset: 0,
      },
      {
        id: 'step-explore',
        kind: 'activity',
        title: 'Guided exploration window',
        dayOffset: 1,
      },
    ]

    if (nights >= 3) {
      steps.push({
        id: 'step-free',
        kind: 'buffer',
        title: 'Free day / soft recovery',
        dayOffset: 2,
      })
    }

    steps.push({
      id: 'step-flight-back',
      kind: 'flight',
      title: 'Return flight',
      dayOffset: nights,
    })

    return {
      destination: draft.destination,
      nights,
      steps,
      assumptions,
    }
  }
}
