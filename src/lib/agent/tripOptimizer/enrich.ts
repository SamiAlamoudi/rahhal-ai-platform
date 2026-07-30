/**
 * Shared post-tool enrichment — Complete Trip Optimizer (Sprint 77).
 */

import type { AgentMemory, TripPlan } from '../types'
import type { BudgetIntelligenceResult } from '../budgetIntelligence/types'
import type { TravelerPersonalizationResult } from '../travelerPersonalization/types'
import { preserveProviderFlights, preserveProviderHotels } from '../preserveProviderInventory'
import { isTripOptimizerEnabled } from './feature'
import { runTripOptimizer } from './orchestrator'
import type { TripOptimizerResult } from './types'

export async function enrichWithTripOptimizer(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userText?: string | null
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  budgetIntelligence?: BudgetIntelligenceResult | null
  travelerPersonalization?: TravelerPersonalizationResult | null
}): Promise<{
  tripPlan: TripPlan
  tripOptimizer: TripOptimizerResult | null
}> {
  if (!isTripOptimizerEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, tripOptimizer: null }
  }

  const result = runTripOptimizer({
    memory: input.memory,
    userText: input.userText,
    flightOffers: input.flightOffers,
    hotelStays: input.hotelStays,
    budgetIntelligence: input.budgetIntelligence,
    travelerPersonalization: input.travelerPersonalization,
  })

  const notes = [
    ...input.tripPlan.notes,
    ...result.recommendationFacts.slice(0, 4).map((fact) => `Trip optimizer: ${fact}`),
  ]

  let nextPlan = { ...input.tripPlan, notes }
  const best = result.recommendations.bestOverall

  if (best && nextPlan.flights.length > 0) {
    const provider = preserveProviderFlights(nextPlan, (flight) => ({
      ...flight,
      notes: [
        flight.notes,
        `Journey ${best.scores.journeyScore}/100 · ${best.labels.join(', ') || 'optimized'} · ${best.reasons.slice(0, 2).join(' · ')}`,
      ].filter(Boolean).join(' · '),
    }))
    if (provider.some((f) => f.fromProvider)) {
      nextPlan = { ...nextPlan, flights: provider }
    } else {
      const payload = best.flight
      nextPlan = {
        ...nextPlan,
        flights: [{
          from: String(payload.from ?? payload.origin ?? nextPlan.flights[0]!.from),
          to: String(payload.to ?? payload.destination ?? nextPlan.flights[0]!.to),
          airline: typeof payload.airline === 'string' ? payload.airline : nextPlan.flights[0]!.airline,
          stops: typeof payload.stops === 'number' ? payload.stops : nextPlan.flights[0]!.stops,
          estimatedCost: typeof payload.price === 'number'
            ? payload.price
            : nextPlan.flights[0]!.estimatedCost,
          currency: typeof payload.currency === 'string'
            ? payload.currency
            : nextPlan.flights[0]!.currency,
          notes: `Journey ${best.scores.journeyScore}/100 · ${best.labels.join(', ') || 'optimized'} · ${best.reasons.slice(0, 2).join(' · ')}`,
        }, ...nextPlan.flights.slice(1)],
      }
    }
  }

  if (best && nextPlan.accommodations.length > 0) {
    const providerHotels = preserveProviderHotels(nextPlan)
    if (providerHotels.some((h) => h.fromProvider)) {
      nextPlan = { ...nextPlan, accommodations: providerHotels }
    } else {
      const payload = best.hotel
      nextPlan = {
        ...nextPlan,
        accommodations: [{
          name: String(payload.name ?? best.title),
          area: String(payload.area ?? nextPlan.accommodations[0]!.area),
          category: nextPlan.accommodations[0]!.category,
          fit: `Journey ${best.scores.journeyScore}/100 · comfort ${best.scores.comfortScore}`,
          estimatedNightly: typeof payload.nightly === 'number'
            ? payload.nightly
            : nextPlan.accommodations[0]!.estimatedNightly,
          currency: typeof payload.currency === 'string'
            ? payload.currency
            : nextPlan.accommodations[0]!.currency,
        }, ...nextPlan.accommodations.slice(1)],
      }
    }
  }

  return {
    tripPlan: nextPlan,
    tripOptimizer: result,
  }
}
