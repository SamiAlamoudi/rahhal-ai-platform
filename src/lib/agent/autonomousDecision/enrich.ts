/**
 * Additive post-tool enrichment — Autonomous Search & Decision Engine (Sprint 79).
 */

import { runDecisionEngine, type StrategyContext } from '../../../core'
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
  if (best && nextPlan.flights.length > 0) {
    const payload = best.flight.payload
    nextPlan = {
      ...nextPlan,
      flights: [{
        from: String(payload.from ?? payload.origin ?? nextPlan.flights[0]!.from),
        to: String(payload.to ?? payload.destination ?? nextPlan.flights[0]!.to),
        airline: best.flight.airline || nextPlan.flights[0]!.airline,
        stops: best.flight.stops,
        estimatedCost: best.flight.price,
        currency: best.currency,
        notes: `Decision ${best.score?.overall ?? 0}/100 · ${best.labels.join(', ')} · conf ${result.recommendations.confidence}%`,
      }, ...nextPlan.flights.slice(1)],
    }
  }
  if (best && nextPlan.accommodations.length > 0) {
    nextPlan = {
      ...nextPlan,
      accommodations: [{
        name: best.hotel.name,
        area: String(best.hotel.payload.area ?? nextPlan.accommodations[0]!.area),
        category: nextPlan.accommodations[0]!.category,
        fit: `Decision score ${best.score?.overall ?? 0}/100`,
        estimatedNightly: typeof best.hotel.payload.nightly === 'number'
          ? best.hotel.payload.nightly
          : nextPlan.accommodations[0]!.estimatedNightly,
        currency: best.currency,
      }, ...nextPlan.accommodations.slice(1)],
    }
  }

  return { tripPlan: nextPlan, autonomousDecision: result }
}
