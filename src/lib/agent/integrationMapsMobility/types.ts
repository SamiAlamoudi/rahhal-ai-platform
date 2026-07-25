/**
 * Integration Sprint 8 — Maps & Live Mobility contracts.
 * Spatial awareness: where the traveler is, where to go, how to get there.
 * Live Google Maps optional; mock provider is default.
 */

export const INTEGRATION_MAPS_MOBILITY_VERSION = '1.0.0-integration-maps-mobility'

export type MobilityMode = 'walking' | 'driving' | 'transit' | 'taxi' | 'rideshare'

export interface GeoCoordinates {
  lat: number
  lng: number
}

export interface MapPlace {
  id: string
  labelEn: string
  labelAr: string
  address: string | null
  coordinates: GeoCoordinates | null
  city: string | null
  country: string | null
  placeTypes: string[]
  source: 'mock' | 'live' | 'plan'
}

export interface MobilityRouteStep {
  instructionEn: string
  instructionAr: string
  distanceMeters: number
  durationMinutes: number
  mode: MobilityMode
}

export interface MobilityRoute {
  id: string
  from: MapPlace
  to: MapPlace
  mode: MobilityMode
  distanceKm: number
  durationMinutes: number
  summaryEn: string
  summaryAr: string
  steps: MobilityRouteStep[]
  leaveByIso: string | null
  trafficAware: boolean
  source: 'mock' | 'live'
}

export interface NearbyPlace {
  place: MapPlace
  category: 'restaurant' | 'cafe' | 'attraction' | 'pharmacy' | 'atm' | 'transit' | 'other'
  distanceMeters: number
  walkMinutes: number
  whyEn: string
  whyAr: string
}

export interface SpatialContext {
  origin: MapPlace | null
  destination: MapPlace | null
  currentLabelEn: string | null
  currentLabelAr: string | null
  city: string | null
}

export type MapsMobilityIntent =
  | 'where_am_i'
  | 'how_to_get_there'
  | 'nearby'
  | 'eta'
  | 'leave_by'
  | 'route'
  | 'unknown'

export interface MapsMobilityResult {
  version: string
  enabled: boolean
  ok: boolean
  live: boolean
  intent: MapsMobilityIntent
  spatial: SpatialContext
  origin: MapPlace | null
  destination: MapPlace | null
  route: MobilityRoute | null
  alternatives: MobilityRoute[]
  nearby: NearbyPlace[]
  consultantSummaryEn: string
  consultantSummaryAr: string
  latencyMs: number
  logs: string[]
}

/** Map provider abstraction — mock or live adapters implement this. */
export interface MapProvider {
  readonly providerId: string
  readonly live: boolean
  geocode(query: string, signal?: AbortSignal): Promise<MapPlace[]>
  reverseGeocode(coords: GeoCoordinates, signal?: AbortSignal): Promise<MapPlace[]>
  nearby(input: {
    near: MapPlace | GeoCoordinates
    query?: string | null
    radiusMeters?: number
    signal?: AbortSignal
  }): Promise<NearbyPlace[]>
  route(input: {
    from: MapPlace | GeoCoordinates | string
    to: MapPlace | GeoCoordinates | string
    mode?: MobilityMode
    arriveByIso?: string | null
    signal?: AbortSignal
  }): Promise<MobilityRoute | null>
}
