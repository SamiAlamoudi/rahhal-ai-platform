/**
 * Integration Sprint 8 — Mock MapProvider (default; no network).
 */

import { MOCK_PLACES, findMockPlaces, haversineMeters } from './catalog'
import type {
  GeoCoordinates,
  MapPlace,
  MapProvider,
  MobilityMode,
  MobilityRoute,
  NearbyPlace,
} from './types'

function asCoords(input: MapPlace | GeoCoordinates | string): GeoCoordinates | null {
  if (typeof input === 'string') {
    const hit = findMockPlaces(input)[0]
    return hit?.coordinates ?? null
  }
  if ('lat' in input && 'lng' in input && typeof (input as GeoCoordinates).lat === 'number') {
    return input as GeoCoordinates
  }
  return (input as MapPlace).coordinates
}

function asPlace(input: MapPlace | GeoCoordinates | string, fallbackLabel: string): MapPlace {
  if (typeof input === 'string') {
    return findMockPlaces(input)[0] ?? {
      id: `query-${fallbackLabel}`,
      labelEn: input,
      labelAr: input,
      address: input,
      coordinates: null,
      city: null,
      country: null,
      placeTypes: [],
      source: 'mock',
    }
  }
  if ('labelEn' in input) return input
  return {
    id: `coord-${input.lat.toFixed(3)}-${input.lng.toFixed(3)}`,
    labelEn: fallbackLabel,
    labelAr: fallbackLabel,
    address: null,
    coordinates: input,
    city: null,
    country: null,
    placeTypes: [],
    source: 'mock',
  }
}

function speedKmh(mode: MobilityMode): number {
  switch (mode) {
    case 'walking': return 4.5
    case 'transit': return 28
    case 'taxi':
    case 'rideshare':
    case 'driving': return 35
    default: return 25
  }
}

function leaveBy(arriveByIso: string | null | undefined, durationMinutes: number): string | null {
  if (!arriveByIso) return null
  const arrive = new Date(arriveByIso)
  if (Number.isNaN(arrive.getTime())) return null
  arrive.setUTCMinutes(arrive.getUTCMinutes() - Math.max(1, durationMinutes) - 10)
  return arrive.toISOString()
}

export class MockMapProvider implements MapProvider {
  readonly providerId = 'mock_maps'
  readonly live = false

  async geocode(query: string): Promise<MapPlace[]> {
    const hits = findMockPlaces(query)
    if (hits.length) return hits
    // Soft city fallback
    const city = MOCK_PLACES.find((p) => p.placeTypes.includes('city') || p.placeTypes.includes('locality'))
    return city
      ? [{
        ...city,
        id: `soft-${query.toLowerCase().replace(/\s+/g, '-')}`,
        labelEn: query,
        labelAr: query,
        address: query,
      }]
      : []
  }

  async reverseGeocode(coords: GeoCoordinates): Promise<MapPlace[]> {
    const ranked = MOCK_PLACES
      .filter((p) => p.coordinates)
      .map((p) => ({ p, d: haversineMeters(coords, p.coordinates!) }))
      .sort((a, b) => a.d - b.d)
    if (!ranked[0]) {
      return [{
        id: `rev-${coords.lat}-${coords.lng}`,
        labelEn: 'Current location',
        labelAr: 'الموقع الحالي',
        address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
        coordinates: coords,
        city: null,
        country: null,
        placeTypes: ['geocode'],
        source: 'mock',
      }]
    }
    return [{ ...ranked[0].p, source: 'mock' }]
  }

  async nearby(input: {
    near: MapPlace | GeoCoordinates
    query?: string | null
    radiusMeters?: number
  }): Promise<NearbyPlace[]> {
    const coords = asCoords(input.near)
    if (!coords) return []
    const radius = input.radiusMeters ?? 2500
    const q = (input.query ?? '').toLowerCase()
    return MOCK_PLACES
      .filter((p) => p.coordinates && p.id !== (input.near as MapPlace).id)
      .map((p) => {
        const distanceMeters = Math.round(haversineMeters(coords, p.coordinates!))
        const walkMinutes = Math.max(1, Math.round(distanceMeters / 80))
        const category = p.placeTypes.includes('airport')
          ? 'transit' as const
          : p.placeTypes.includes('attraction') || p.placeTypes.includes('place_of_worship')
            ? 'attraction' as const
            : p.placeTypes.includes('lodging')
              ? 'other' as const
              : 'other' as const
        return {
          place: p,
          category,
          distanceMeters,
          walkMinutes,
          whyEn: `${Math.round(distanceMeters / 100) / 10} km away · ~${walkMinutes} min walk`,
          whyAr: `يبعد ${Math.round(distanceMeters / 100) / 10} كم · مشي نحو ${walkMinutes} دقيقة`,
        } satisfies NearbyPlace
      })
      .filter((n) => n.distanceMeters <= radius)
      .filter((n) => !q || n.place.labelEn.toLowerCase().includes(q) || n.place.placeTypes.some((t) => t.includes(q)))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 6)
  }

  async route(input: {
    from: MapPlace | GeoCoordinates | string
    to: MapPlace | GeoCoordinates | string
    mode?: MobilityMode
    arriveByIso?: string | null
  }): Promise<MobilityRoute | null> {
    const mode = input.mode ?? 'transit'
    const from = asPlace(input.from, 'Origin')
    const to = asPlace(input.to, 'Destination')
    const fromC = from.coordinates
    const toC = to.coordinates
    if (!fromC || !toC) return null
    const distanceMeters = haversineMeters(fromC, toC)
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10
    const durationMinutes = Math.max(5, Math.round((distanceKm / speedKmh(mode)) * 60))
    return {
      id: `route-${from.id}-${to.id}-${mode}`,
      from,
      to,
      mode,
      distanceKm,
      durationMinutes,
      summaryEn: `${mode} · ${distanceKm} km · ~${durationMinutes} min`,
      summaryAr: `${mode} · ${distanceKm} كم · نحو ${durationMinutes} دقيقة`,
      steps: [
        {
          instructionEn: `Start at ${from.labelEn}`,
          instructionAr: `ابدأ من ${from.labelAr}`,
          distanceMeters: Math.round(distanceMeters * 0.1),
          durationMinutes: Math.max(1, Math.round(durationMinutes * 0.1)),
          mode,
        },
        {
          instructionEn: `Continue toward ${to.labelEn}`,
          instructionAr: `تابع نحو ${to.labelAr}`,
          distanceMeters: Math.round(distanceMeters * 0.8),
          durationMinutes: Math.max(2, Math.round(durationMinutes * 0.8)),
          mode,
        },
        {
          instructionEn: `Arrive at ${to.labelEn}`,
          instructionAr: `الوصول إلى ${to.labelAr}`,
          distanceMeters: Math.round(distanceMeters * 0.1),
          durationMinutes: Math.max(1, Math.round(durationMinutes * 0.1)),
          mode,
        },
      ],
      leaveByIso: leaveBy(input.arriveByIso, durationMinutes),
      trafficAware: false,
      source: 'mock',
    }
  }
}

export function createMockMapProvider(): MapProvider {
  return new MockMapProvider()
}
