/**
 * Integration Sprint 8 — Live MapProvider adapter (optional).
 * Wraps existing GoogleMapsApiClient. Never reads VITE_* secrets.
 * Falls back gracefully when credentials are missing.
 */

import type { CanonicalLocation, CanonicalRouteLeg } from '../../../integrations/providers/googleMaps/types'
import type {
  GeoCoordinates,
  MapPlace,
  MapProvider,
  MobilityMode,
  MobilityRoute,
  NearbyPlace,
} from './types'
import { createMockMapProvider } from './mockProvider'

function toPlace(loc: CanonicalLocation, source: 'live' | 'mock' = 'live'): MapPlace {
  return {
    id: loc.placeId ?? `live-${loc.label}`,
    labelEn: loc.name || loc.label,
    labelAr: loc.name || loc.label,
    address: loc.formattedAddress,
    coordinates: loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null,
    city: loc.city,
    country: loc.country,
    placeTypes: loc.types ?? [],
    source,
  }
}

function modeToGoogle(mode: MobilityMode): string {
  if (mode === 'walking') return 'walking'
  if (mode === 'transit') return 'transit'
  if (mode === 'taxi' || mode === 'rideshare' || mode === 'driving') return 'driving'
  return 'transit'
}

export class LiveGoogleMapsProvider implements MapProvider {
  readonly providerId = 'google_maps_live'
  readonly live = true
  private readonly fallback = createMockMapProvider()
  private client: {
    geocode: (q: string) => Promise<CanonicalLocation[]>
    reverseGeocode: (lat: number, lng: number) => Promise<CanonicalLocation[]>
    placeSearch: (q: string, type?: string) => Promise<CanonicalLocation[]>
    distanceMatrix: (input: {
      origins: string[]
      destinations: string[]
      mode?: string
    }) => Promise<CanonicalRouteLeg[]>
  } | null

  constructor(client?: LiveGoogleMapsProvider['client'] | null) {
    this.client = client ?? null
  }

  private ensureClient(): NonNullable<LiveGoogleMapsProvider['client']> | null {
    return this.client
  }

  async geocode(query: string): Promise<MapPlace[]> {
    const client = this.ensureClient()
    if (!client) return this.fallback.geocode(query)
    try {
      const rows = await client.geocode(query)
      return rows.map((r) => toPlace(r))
    } catch {
      return this.fallback.geocode(query)
    }
  }

  async reverseGeocode(coords: GeoCoordinates): Promise<MapPlace[]> {
    const client = this.ensureClient()
    if (!client) return this.fallback.reverseGeocode(coords)
    try {
      const rows = await client.reverseGeocode(coords.lat, coords.lng)
      return rows.map((r) => toPlace(r))
    } catch {
      return this.fallback.reverseGeocode(coords)
    }
  }

  async nearby(input: {
    near: MapPlace | GeoCoordinates
    query?: string | null
    radiusMeters?: number
  }): Promise<NearbyPlace[]> {
    const client = this.ensureClient()
    if (!client) return this.fallback.nearby(input)
    const label = 'labelEn' in input.near
      ? input.near.labelEn
      : `${input.near.lat},${input.near.lng}`
    try {
      const rows = await client.placeSearch(input.query?.trim() || `places near ${label}`)
      return rows.slice(0, 6).map((r, idx) => {
        const place = toPlace(r)
        const distanceMeters = 400 + idx * 250
        const walkMinutes = Math.max(1, Math.round(distanceMeters / 80))
        return {
          place,
          category: 'other' as const,
          distanceMeters,
          walkMinutes,
          whyEn: `Nearby match · ~${walkMinutes} min walk`,
          whyAr: `قريب · مشي نحو ${walkMinutes} دقيقة`,
        }
      })
    } catch {
      return this.fallback.nearby(input)
    }
  }

  async route(input: {
    from: MapPlace | GeoCoordinates | string
    to: MapPlace | GeoCoordinates | string
    mode?: MobilityMode
    arriveByIso?: string | null
  }): Promise<MobilityRoute | null> {
    const client = this.ensureClient()
    if (!client) return this.fallback.route(input)
    const mode = input.mode ?? 'transit'
    const fromLabel = typeof input.from === 'string'
      ? input.from
      : 'labelEn' in input.from
        ? input.from.labelEn
        : `${input.from.lat},${input.from.lng}`
    const toLabel = typeof input.to === 'string'
      ? input.to
      : 'labelEn' in input.to
        ? input.to.labelEn
        : `${input.to.lat},${input.to.lng}`
    try {
      const legs = await client.distanceMatrix({
        origins: [fromLabel],
        destinations: [toLabel],
        mode: modeToGoogle(mode),
      })
      const leg = legs[0]
      if (!leg) return this.fallback.route(input)
      const from = leg.fromLocation ? toPlace(leg.fromLocation) : (await this.geocode(fromLabel))[0]!
      const to = leg.toLocation ? toPlace(leg.toLocation) : (await this.geocode(toLabel))[0]!
      let leaveByIso: string | null = null
      if (input.arriveByIso) {
        const arrive = new Date(input.arriveByIso)
        if (!Number.isNaN(arrive.getTime())) {
          arrive.setUTCMinutes(arrive.getUTCMinutes() - leg.durationMinutes - 10)
          leaveByIso = arrive.toISOString()
        }
      }
      return {
        id: `live-route-${from.id}-${to.id}-${mode}`,
        from,
        to,
        mode,
        distanceKm: leg.distanceKm,
        durationMinutes: leg.durationMinutes,
        summaryEn: `${mode} · ${leg.distanceKm} km · ~${leg.durationMinutes} min`,
        summaryAr: `${mode} · ${leg.distanceKm} كم · نحو ${leg.durationMinutes} دقيقة`,
        steps: [{
          instructionEn: `Go from ${from.labelEn} to ${to.labelEn}`,
          instructionAr: `من ${from.labelAr} إلى ${to.labelAr}`,
          distanceMeters: Math.round(leg.distanceKm * 1000),
          durationMinutes: leg.durationMinutes,
          mode,
        }],
        leaveByIso,
        trafficAware: false,
        source: 'live',
      }
    } catch {
      return this.fallback.route(input)
    }
  }
}

export function createLiveGoogleMapsProvider(
  client?: ConstructorParameters<typeof LiveGoogleMapsProvider>[0],
): MapProvider {
  return new LiveGoogleMapsProvider(client)
}
