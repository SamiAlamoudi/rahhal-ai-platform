/**
 * Integration Sprint 7 — Location abstraction only (no live maps/GPS).
 */

import type { TripPlan } from '../types'
import type { CompanionLocationLayer, CompanionLocationRef } from './types'

function ref(partial: Omit<CompanionLocationRef, 'coordinates' | 'accuracyMeters' | 'source'> & {
  source?: CompanionLocationRef['source']
}): CompanionLocationRef {
  return {
    ...partial,
    coordinates: null,
    accuracyMeters: null,
    source: partial.source ?? 'plan',
  }
}

export function buildCompanionLocationLayer(plan: TripPlan | null): CompanionLocationLayer {
  const cityName = plan?.destinations[0] ?? plan?.requirements.destination ?? null
  const hotel = plan?.accommodations[0]
  const city = cityName
    ? ref({
      id: `city-${cityName.toLowerCase().replace(/\s+/g, '-')}`,
      labelEn: cityName,
      labelAr: cityName,
      city: cityName,
      country: null,
      source: 'plan',
    })
    : null

  const hotelRef = hotel
    ? ref({
      id: `hotel-${hotel.name.toLowerCase().replace(/\s+/g, '-')}`,
      labelEn: hotel.name,
      labelAr: hotel.name,
      city: cityName,
      country: null,
      source: 'hotel',
    })
    : null

  return {
    current: hotelRef ?? city,
    hotel: hotelRef,
    city,
    nearbyReady: false,
    walkingRoutesReady: false,
    mapsReady: false,
  }
}

/** Future extension points — not wired to live providers. */
export interface FutureLocationCapabilities {
  gps: false
  maps: false
  nearbyPlaces: false
  walkingRoutes: false
}

export const FUTURE_LOCATION_CAPABILITIES: FutureLocationCapabilities = {
  gps: false,
  maps: false,
  nearbyPlaces: false,
  walkingRoutes: false,
}
