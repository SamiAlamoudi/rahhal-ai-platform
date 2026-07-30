/**
 * Additive post-tool enrichment — Autonomous Search & Decision Engine (Sprint 79).
 * Sprint 80 — optional learned TravelerProfile for ranking adjustments.
 */

import {
  runDecisionEngine,
  type StrategyContext,
  type TravelerProfile,
} from '../../../core'
import type { AgentMemory, TripPlan } from '../types'
import type { TravelPlannerResult } from '../travelPlanner/types'
import { isAutonomousDecisionEnabled } from './feature'
import type { AutonomousDecisionResult } from './types'

function strategyFromPlanner(
  planner: TravelPlannerResult | null | undefined,
  memory: AgentMemory,
): StrategyContext {
  return {
    purpose: planner?.travelPurpose ?? memory.requirements.tripPurpose,
    priorityHints: planner?.priorityWeights ?? null,
    budgetAmount: memory.requirements.budgetAmount
      ?? planner?.constraints.find((c) => c.kind === 'budget')?.value as number | undefined
      ?? null,
    preferDirect: planner?.constraints.some((c) => c.kind === 'direct_flight') === true,
    hotelBrandLocked: planner?.constraints.some((c) => c.kind === 'hotel_brand') === true
      || planner?.riskFlags.includes('hotel_brand_locked') === true,
    hasChildren: planner?.constraints.some((c) => c.kind === 'children') === true
      || memory.requirements.travelerType === 'family',
    loyaltyPreferred: planner?.preferences.some((p) => p.kind === 'airline' && p.polarity === 'prefer') === true,
  }
}

export async function enrichWithAutonomousDecision(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  travelPlanner?: TravelPlannerResult | null
  /** Sprint 80 — local learned preferences for Decision Engine. */
  learnedProfile?: TravelerProfile | null
}): Promise<{
  tripPlan: TripPlan
  autonomousDecision: AutonomousDecisionResult | null
}> {
  if (!isAutonomousDecisionEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, autonomousDecision: null }
  }

  const result = await runDecisionEngine({
    flightOffers: input.flightOffers,
    hotelStays: input.hotelStays,
    strategy: strategyFromPlanner(input.travelPlanner, input.memory),
    budgetCap: input.memory.requirements.budgetAmount,
    learnedProfile: input.learnedProfile ?? null,
  })

  const best = result.recommendations.bestOverall
  const notes = [
    ...input.tripPlan.notes,
    ...(best
      ? [
        `Decision engine: ${best.title} · score ${best.score?.overall ?? 0}/100 · ${best.labels.join(', ') || 'recommended'}`,
        result.recommendations.explanation.split('\n')[0] ?? '',
      ].filter(Boolean)
      : ['Decision engine: no candidates']),
  ]

  let nextPlan = { ...input.tripPlan, notes }
  // Preserve full provider inventory for selectable booking cards.
  // Only annotate the top flight — never collapse or strip booking fields.
  if (best && nextPlan.flights.length > 0) {
    const providerFlights = nextPlan.flights.filter((f) => f.fromProvider === true)
    if (providerFlights.length > 0) {
      const annotated = providerFlights.map((flight, index) => (
        index === 0
          ? {
            ...flight,
            notes: [
              flight.notes,
              `Decision ${best.score?.overall ?? 0}/100 · ${best.labels.join(', ')} · conf ${result.recommendations.confidence}%`,
            ].filter(Boolean).join(' · '),
          }
          : flight
      ))
      nextPlan = { ...nextPlan, flights: annotated }
    } else {
      const payload = best.flight.payload
      const head = nextPlan.flights[0]!
      nextPlan = {
        ...nextPlan,
        flights: [{
          ...head,
          from: String(payload.from ?? payload.origin ?? head.from),
          to: String(payload.to ?? payload.destination ?? head.to),
          airline: best.flight.airline || head.airline,
          stops: best.flight.stops ?? head.stops,
          estimatedCost: best.flight.price ?? head.estimatedCost,
          currency: best.currency || head.currency,
          notes: `Decision ${best.score?.overall ?? 0}/100 · ${best.labels.join(', ')} · conf ${result.recommendations.confidence}%`,
        }, ...nextPlan.flights.slice(1)],
      }
    }
  }
  if (best && nextPlan.accommodations.length > 0) {
    const providerHotels = nextPlan.accommodations.filter((h) => h.fromProvider === true)
    if (providerHotels.length > 0) {
      nextPlan = { ...nextPlan, accommodations: providerHotels }
    } else {
      nextPlan = {
        ...nextPlan,
        accommodations: [{
          ...nextPlan.accommodations[0]!,
          name: best.hotel.name,
          area: String(best.hotel.payload.area ?? nextPlan.accommodations[0]!.area),
          fit: `Decision score ${best.score?.overall ?? 0}/100`,
          estimatedNightly: typeof best.hotel.payload.nightly === 'number'
            ? best.hotel.payload.nightly
            : nextPlan.accommodations[0]!.estimatedNightly,
          currency: best.currency,
        }, ...nextPlan.accommodations.slice(1)],
      }
    }
  }

  return { tripPlan: nextPlan, autonomousDecision: result }
}
