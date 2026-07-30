/**
 * Booking-agent guard: enrichment layers may annotate a preferred option,
 * but must never collapse or strip provider-backed flight/hotel inventory.
 */

import type { AccommodationRecommendation, FlightRecommendation, TripPlan } from './types'

export function preserveProviderFlights(
  plan: TripPlan,
  annotateTop?: (flight: FlightRecommendation) => FlightRecommendation,
): FlightRecommendation[] {
  const provider = plan.flights.filter((f) => f.fromProvider === true)
  if (provider.length === 0) return plan.flights
  if (!annotateTop) return provider
  return provider.map((flight, index) => (index === 0 ? annotateTop(flight) : flight))
}

export function preserveProviderHotels(plan: TripPlan): AccommodationRecommendation[] {
  const provider = plan.accommodations.filter((h) => h.fromProvider === true)
  return provider.length > 0 ? provider : plan.accommodations
}
