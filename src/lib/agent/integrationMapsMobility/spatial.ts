/**
 * Integration Sprint 8 — derive spatial context from trip plan / traveler cues.
 */

import type { TripPlan } from '../types'
import { findMockPlaces } from './catalog'
import type { MapPlace, MapProvider, SpatialContext } from './types'

export async function resolvePlaces(input: {
  plan: TripPlan | null
  provider: MapProvider
  originQuery?: string | null
  destinationQuery?: string | null
  coords?: { lat: number; lng: number } | null
}): Promise<{ origin: MapPlace | null; destination: MapPlace | null; city: string | null }> {
  let origin: MapPlace | null = null
  let destination: MapPlace | null = null

  if (input.coords) {
    origin = (await input.provider.reverseGeocode(input.coords))[0] ?? null
  }

  if (!origin && input.originQuery) {
    origin = (await input.provider.geocode(input.originQuery))[0] ?? null
  }

  if (!origin && input.plan?.accommodations[0]) {
    const hotelName = input.plan.accommodations[0].name
    origin = (await input.provider.geocode(hotelName))[0]
      ?? findMockPlaces(hotelName)[0]
      ?? {
        id: `hotel-${hotelName}`,
        labelEn: hotelName,
        labelAr: hotelName,
        address: input.plan.accommodations[0].area,
        coordinates: null,
        city: input.plan.destinations[0] ?? null,
        country: null,
        placeTypes: ['lodging'],
        source: 'plan',
      }
  }

  if (!origin && input.plan?.destinations[0]) {
    origin = (await input.provider.geocode(input.plan.destinations[0]))[0] ?? null
  }

  if (input.destinationQuery) {
    destination = (await input.provider.geocode(input.destinationQuery))[0] ?? null
  }

  if (!destination && input.plan?.flights[0]?.to) {
    const airportHint = input.plan.flights[0].to
    destination = (await input.provider.geocode(airportHint))[0]
      ?? findMockPlaces(airportHint)[0]
      ?? findMockPlaces('airport')[0]
      ?? null
  }

  const city = origin?.city
    ?? destination?.city
    ?? input.plan?.destinations[0]
    ?? null

  return { origin, destination, city }
}

export function toSpatialContext(
  origin: MapPlace | null,
  destination: MapPlace | null,
  city: string | null,
): SpatialContext {
  return {
    origin,
    destination,
    currentLabelEn: origin?.labelEn ?? null,
    currentLabelAr: origin?.labelAr ?? null,
    city,
  }
}
