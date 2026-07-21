/**
 * Sprint 79 — execute a SearchPlan against offer pools (independent, parallelizable).
 */

import { scoreItinerary } from '../searchScoring/scoreCandidate'
import { emitDecisionEvent } from '../observability/events'
import type {
  DecisionEvent,
  FlightCandidateFacts,
  HotelCandidateFacts,
  SearchCandidate,
  SearchPlan,
} from '../types'
import { candidateKey } from './normalize'

function passesConstraints(
  plan: SearchPlan,
  flight: FlightCandidateFacts,
  hotel: HotelCandidateFacts,
  totalPrice: number,
): boolean {
  const c = plan.acceptableConstraints
  if (c.maxPrice != null && totalPrice > c.maxPrice) {
    // cheapest plan still keeps over-budget as fallback candidates later
    if (plan.objective !== 'cheapest') return false
  }
  if (c.maxDurationMinutes != null && flight.durationMinutes != null
    && flight.durationMinutes > c.maxDurationMinutes) {
    return false
  }
  if (c.maxStops != null && flight.stops > c.maxStops) return false
  if (c.preferDirect && flight.stops > 0 && plan.objective === 'fastest') return false
  if (c.maxLayoverMinutes != null && flight.layoverMinutes != null
    && flight.layoverMinutes > c.maxLayoverMinutes) {
    return false
  }
  if (c.minHotelStars != null && hotel.stars != null && hotel.stars < c.minHotelStars) {
    return false
  }
  if (c.maxWalkMinutes != null && hotel.walkMinutes != null
    && hotel.walkMinutes > c.maxWalkMinutes) {
    return false
  }
  if (c.requireRefundable && !(flight.refundable || hotel.refundable)) return false
  if (c.loyaltyPreferred && !flight.loyaltyMatch && plan.objective === 'loyalty_friendly') {
    // soft filter — still allow if nothing else; handled by caller fallback
    return flight.loyaltyMatch
  }
  return true
}

export function executeSearchPlan(input: {
  plan: SearchPlan
  flights: FlightCandidateFacts[]
  hotels: HotelCandidateFacts[]
  budgetCap?: number | null
  maxCombinations?: number
  events?: DecisionEvent[]
}): { candidates: SearchCandidate[]; fallbackUsed: boolean } {
  const { plan, flights, hotels, budgetCap = null, maxCombinations = 12, events } = input
  const orderedFlights = [...flights].sort((a, b) => {
    const ai = plan.providerOrder.indexOf(a.providerId)
    const bi = plan.providerOrder.indexOf(b.providerId)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })

  let fallbackUsed = false
  let pool = orderedFlights.flatMap((flight) =>
    hotels.map((hotel) => ({ flight, hotel, total: flight.price + hotel.price })),
  ).filter(({ flight, hotel, total }) => passesConstraints(plan, flight, hotel, total))

  if (pool.length === 0) {
    fallbackUsed = true
    // Fallback: relax loyalty / refundable / preferDirect
    pool = orderedFlights.flatMap((flight) =>
      hotels.map((hotel) => ({ flight, hotel, total: flight.price + hotel.price })),
    )
    if (plan.acceptableConstraints.maxPrice != null) {
      const capped = pool.filter((p) => p.total <= (plan.acceptableConstraints.maxPrice! * 1.35))
      if (capped.length) pool = capped
    }
  }

  // Objective-oriented shortlist before scoring
  if (plan.objective === 'cheapest') {
    pool = [...pool].sort((a, b) => a.total - b.total).slice(0, maxCombinations)
  } else if (plan.objective === 'fastest') {
    pool = [...pool].sort((a, b) =>
      (a.flight.durationMinutes ?? 9999) - (b.flight.durationMinutes ?? 9999)
      || a.flight.stops - b.flight.stops,
    ).slice(0, maxCombinations)
  } else if (plan.objective === 'premium_comfort') {
    pool = [...pool].sort((a, b) =>
      (b.hotel.stars ?? 0) - (a.hotel.stars ?? 0)
      || (b.hotel.rating ?? 0) - (a.hotel.rating ?? 0),
    ).slice(0, maxCombinations)
  } else {
    pool = pool.slice(0, maxCombinations)
  }

  const candidates: SearchCandidate[] = pool.map(({ flight, hotel, total }, index) => {
    const score = scoreItinerary({
      flight,
      hotel,
      totalPrice: total,
      weights: plan.priorityWeights,
      budgetCap,
    })
    const candidate: SearchCandidate = {
      id: `${plan.id}__${flight.id}__${hotel.id}__${index}`,
      planId: plan.id,
      providerId: `${flight.providerId}+${hotel.providerId}`,
      title: `${flight.airline} + ${hotel.name}`,
      totalPrice: total,
      currency: flight.currency || hotel.currency || 'SAR',
      flight,
      hotel,
      normalizedKey: candidateKey(flight.id, hotel.id),
      score,
      reasons: [],
      labels: [],
    }
    emitDecisionEvent('candidate.generated', {
      planId: plan.id,
      candidateId: candidate.id,
      totalPrice: total,
    }, events)
    emitDecisionEvent('candidate.scored', {
      planId: plan.id,
      candidateId: candidate.id,
      score: score.overall,
    }, events)
    return candidate
  })

  emitDecisionEvent('search.plan.executed', {
    planId: plan.id,
    objective: plan.objective,
    candidateCount: candidates.length,
    fallbackUsed,
  }, events)

  return { candidates, fallbackUsed }
}

/**
 * Execute all plans independently in parallel.
 */
export async function executeSearchPlansParallel(input: {
  plans: SearchPlan[]
  flights: FlightCandidateFacts[]
  hotels: HotelCandidateFacts[]
  budgetCap?: number | null
  events?: DecisionEvent[]
}): Promise<{ candidates: SearchCandidate[]; fallbackUsed: boolean }> {
  const results = await Promise.all(
    input.plans.map(async (plan) =>
      executeSearchPlan({
        plan,
        flights: input.flights,
        hotels: input.hotels,
        budgetCap: input.budgetCap,
        events: input.events,
      }),
    ),
  )
  return {
    candidates: results.flatMap((r) => r.candidates),
    fallbackUsed: results.some((r) => r.fallbackUsed),
  }
}
