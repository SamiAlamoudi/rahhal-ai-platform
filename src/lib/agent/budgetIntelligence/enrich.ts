/**
 * Shared post-tool enrichment — Budget Intelligence (Sprint 75).
 */

import type { AgentMemory, TripPlan } from '../types'
import { isBudgetIntelligenceEnabled } from './feature'
import { runBudgetIntelligence } from './orchestrator'
import type { BudgetIntelligenceResult } from './types'

export async function enrichWithBudgetIntelligence(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userText?: string | null
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
}): Promise<{
  tripPlan: TripPlan
  budgetIntelligence: BudgetIntelligenceResult | null
}> {
  if (!isBudgetIntelligenceEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, budgetIntelligence: null }
  }

  const result = runBudgetIntelligence({
    memory: input.memory,
    tripPlan: input.tripPlan,
    userText: input.userText,
    flightOffers: input.flightOffers,
    hotelStays: input.hotelStays,
  })

  const notes = [
    ...input.tripPlan.notes,
    ...result.recommendationFacts.slice(0, 4).map((fact) => `Budget intelligence: ${fact}`),
  ]

  // Prefer budget-ranked flight/hotel on the plan when scores are available
  let nextPlan = { ...input.tripPlan, notes }
  const topFlight = result.rankedFlights[0]
  const topHotel = result.rankedHotels[0]

  if (topFlight && nextPlan.flights.length > 0) {
    const payload = topFlight.payload
    nextPlan = {
      ...nextPlan,
      flights: [{
        from: String(payload.from ?? nextPlan.flights[0]!.from),
        to: String(payload.to ?? nextPlan.flights[0]!.to),
        airline: typeof payload.airline === 'string' ? payload.airline : nextPlan.flights[0]!.airline,
        stops: typeof payload.stops === 'number' ? payload.stops : nextPlan.flights[0]!.stops,
        estimatedCost: topFlight.price,
        currency: topFlight.currency,
        notes: `Budget score ${topFlight.score.budgetScore}/100 · ${topFlight.reasons.join(' · ')}`,
      }, ...nextPlan.flights.slice(1)],
    }
  }

  if (topHotel && nextPlan.accommodations.length > 0) {
    const payload = topHotel.payload
    nextPlan = {
      ...nextPlan,
      accommodations: [{
        name: topHotel.title,
        area: String(payload.area ?? nextPlan.accommodations[0]!.area),
        category: nextPlan.accommodations[0]!.category,
        fit: `Budget score ${topHotel.score.budgetScore}/100`,
        estimatedNightly: typeof payload.nightly === 'number'
          ? payload.nightly
          : nextPlan.accommodations[0]!.estimatedNightly,
        currency: topHotel.currency,
      }, ...nextPlan.accommodations.slice(1)],
    }
  }

  return {
    tripPlan: nextPlan,
    budgetIntelligence: result,
  }
}
