/**
 * Integration Sprint 4 — soft enrich TripPlan from TripOrchestrator.
 * When flag OFF, returns plan unchanged.
 */

import type { AgentMemory, TripPlan } from '../types'
import { runTripOrchestrator, type TripOrchestratorDeps } from './orchestrator'
import { isIntegrationTripOrchestratorEnabled } from './feature'
import type { TripOrchestratorResult } from './types'

export async function enrichWithIntegrationTripOrchestrator(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userId?: string | null
  userText?: string | null
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  deps?: TripOrchestratorDeps
}): Promise<{
  tripPlan: TripPlan
  tripOrchestrator: TripOrchestratorResult | null
}> {
  if (!isIntegrationTripOrchestratorEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, tripOrchestrator: null }
  }

  const result = await runTripOrchestrator({
    memory: input.memory,
    tripPlan: input.tripPlan,
    userId: input.userId,
    deps: {
      ...input.deps,
      enabled: true,
      flightOffers: input.flightOffers,
      hotelStays: input.hotelStays,
    },
  })

  if (!result.enabled) {
    return { tripPlan: input.tripPlan, tripOrchestrator: result }
  }

  let nextPlan = { ...input.tripPlan }
  const notes = [
    ...nextPlan.notes,
    result.consultantSummaryEn
      ? `Trip orchestrator: ${result.consultantSummaryEn.split('\n')[0]}`
      : 'Trip orchestrator ran',
  ]

  if (result.recommendation?.flight) {
    const f = result.recommendation.flight
    nextPlan = {
      ...nextPlan,
      flights: [{
        from: String(f.from ?? nextPlan.flights[0]?.from ?? ''),
        to: String(f.to ?? nextPlan.flights[0]?.to ?? ''),
        airline: typeof f.airline === 'string' ? f.airline : null,
        stops: typeof f.stops === 'number' ? f.stops : null,
        estimatedCost: typeof f.price === 'number' ? f.price : null,
        currency: typeof f.currency === 'string' ? f.currency : result.recommendation.currency,
        notes: result.recommendation.whyFlightEn,
      }, ...nextPlan.flights.slice(1)],
    }
  }

  if (result.recommendation?.hotel) {
    const h = result.recommendation.hotel
    nextPlan = {
      ...nextPlan,
      accommodations: [{
        name: String(h.name ?? 'Hotel'),
        area: String(h.area ?? 'Center'),
        category: (typeof h.hotelStars === 'number' && h.hotelStars >= 4) ? 'boutique' : 'hotel',
        fit: result.recommendation.whyHotelEn,
        estimatedNightly: typeof h.nightly === 'number' ? h.nightly : null,
        currency: typeof h.currency === 'string' ? h.currency : result.recommendation.currency,
      }, ...nextPlan.accommodations.slice(1)],
    }
  }

  if (result.budget) {
    nextPlan = {
      ...nextPlan,
      estimatedBudget: {
        amount: result.budget.total,
        currency: result.budget.currency,
        breakdown: [
          { label: 'Flights', amount: result.budget.flights },
          { label: 'Hotels', amount: result.budget.hotels },
          { label: 'Transportation', amount: result.budget.transportation },
          { label: 'Activities', amount: result.budget.activities },
          { label: 'Buffer', amount: result.budget.buffer },
        ],
      },
      estimatedCosts: {
        amount: result.budget.total,
        currency: result.budget.currency,
        breakdown: [
          { label: 'Flights', amount: result.budget.flights },
          { label: 'Hotels', amount: result.budget.hotels },
          { label: 'Transportation', amount: result.budget.transportation },
          { label: 'Activities', amount: result.budget.activities },
          { label: 'Buffer', amount: result.budget.buffer },
        ],
      },
    }
  }

  if (result.itinerary?.days.length) {
    const days = result.itinerary.days.map((d) => ({
      day: d.day,
      title: d.title,
      location: d.location,
      activities: d.items.map((title) => ({ time: null, title, description: null })),
    }))
    // Only replace empty/placeholder itineraries — keep richer existing days when present.
    if (nextPlan.dailyItinerary.length === 0) {
      nextPlan = {
        ...nextPlan,
        dailyItinerary: days,
        activities: days,
      }
    }
  }

  const summaryLine = input.memory.locale === 'ar'
    ? result.consultantSummaryAr.split('\n')[0]
    : result.consultantSummaryEn.split('\n')[0]

  nextPlan = {
    ...nextPlan,
    notes,
    summary: summaryLine || nextPlan.summary,
  }

  return { tripPlan: nextPlan, tripOrchestrator: result }
}
