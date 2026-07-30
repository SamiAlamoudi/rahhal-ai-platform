/**
 * Shared post-tool enrichment — Traveler Personalization (Sprint 76).
 */

import type { AgentMemory, TripPlan } from '../types'
import { preserveProviderFlights, preserveProviderHotels } from '../preserveProviderInventory'
import { isTravelerPersonalizationEnabled } from './feature'
import { runTravelerPersonalization } from './orchestrator'
import type { TravelerPersonalizationResult } from './types'
import type { TravelerProfileStore } from './storage'

export async function enrichWithTravelerPersonalization(input: {
  userId: string | null | undefined
  memory: AgentMemory
  tripPlan: TripPlan
  userText?: string | null
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  store?: TravelerProfileStore
  skipLearning?: boolean
}): Promise<{
  tripPlan: TripPlan
  travelerPersonalization: TravelerPersonalizationResult | null
}> {
  if (!isTravelerPersonalizationEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, travelerPersonalization: null }
  }

  const result = runTravelerPersonalization({
    userId: input.userId,
    userText: input.userText,
    memory: input.memory,
    flightOffers: input.flightOffers,
    hotelStays: input.hotelStays,
    store: input.store,
    skipLearning: input.skipLearning,
  })

  const notes = [
    ...input.tripPlan.notes,
    ...result.recommendationFacts.slice(0, 4).map((fact) => `Personalization: ${fact}`),
  ]

  let nextPlan = { ...input.tripPlan, notes }
  const topFlight = result.rankedFlights[0]
  const topHotel = result.rankedHotels[0]

  if (topFlight && topFlight.delta > 0 && nextPlan.flights.length > 0) {
    const provider = preserveProviderFlights(nextPlan, (flight) => ({
      ...flight,
      notes: [
        flight.notes,
        `Personalized score ${topFlight.personalizedScore}/100 · ${topFlight.reasons.join(' · ')}`,
      ].filter(Boolean).join(' · '),
    }))
    if (provider.some((f) => f.fromProvider)) {
      nextPlan = { ...nextPlan, flights: provider }
    } else {
      const payload = topFlight.payload
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
          notes: `Personalized score ${topFlight.personalizedScore}/100 · ${topFlight.reasons.join(' · ')}`,
        }, ...nextPlan.flights.slice(1)],
      }
    }
  }

  if (topHotel && topHotel.delta > 0 && nextPlan.accommodations.length > 0) {
    const providerHotels = preserveProviderHotels(nextPlan)
    if (providerHotels.some((h) => h.fromProvider)) {
      nextPlan = { ...nextPlan, accommodations: providerHotels }
    } else {
      const payload = topHotel.payload
      nextPlan = {
        ...nextPlan,
        accommodations: [{
          name: topHotel.title,
          area: String(payload.area ?? nextPlan.accommodations[0]!.area),
          category: nextPlan.accommodations[0]!.category,
          fit: `Personalized score ${topHotel.personalizedScore}/100`,
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
    travelerPersonalization: result,
  }
}
