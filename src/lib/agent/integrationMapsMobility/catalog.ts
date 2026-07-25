/**
 * Integration Sprint 8 — curated mock place catalog for spatial awareness.
 */

import type { MapPlace } from './types'

function place(p: MapPlace): MapPlace {
  return p
}

/** Deterministic mock places — no network. */
export const MOCK_PLACES: MapPlace[] = [
  place({
    id: 'casablanca-center',
    labelEn: 'Casablanca City Center',
    labelAr: 'وسط الدار البيضاء',
    address: 'Casablanca, Morocco',
    coordinates: { lat: 33.5731, lng: -7.5898 },
    city: 'Casablanca',
    country: 'Morocco',
    placeTypes: ['locality', 'city'],
    source: 'mock',
  }),
  place({
    id: 'casa-hotel',
    labelEn: 'Casa Business Suites',
    labelAr: 'أجنحة كازا للأعمال',
    address: 'Maarif, Casablanca',
    coordinates: { lat: 33.5892, lng: -7.6325 },
    city: 'Casablanca',
    country: 'Morocco',
    placeTypes: ['lodging', 'hotel'],
    source: 'mock',
  }),
  place({
    id: 'cmn-airport',
    labelEn: 'Mohammed V Airport (CMN)',
    labelAr: 'مطار محمد الخامس',
    address: 'Nouaceur, Casablanca',
    coordinates: { lat: 33.3675, lng: -7.5898 },
    city: 'Casablanca',
    country: 'Morocco',
    placeTypes: ['airport'],
    source: 'mock',
  }),
  place({
    id: 'hassan-ii',
    labelEn: 'Hassan II Mosque',
    labelAr: 'مسجد الحسن الثاني',
    address: 'Boulevard de la Corniche, Casablanca',
    coordinates: { lat: 33.6089, lng: -7.6328 },
    city: 'Casablanca',
    country: 'Morocco',
    placeTypes: ['attraction', 'place_of_worship'],
    source: 'mock',
  }),
  place({
    id: 'paris-center',
    labelEn: 'Paris Center',
    labelAr: 'وسط باريس',
    address: 'Paris, France',
    coordinates: { lat: 48.8566, lng: 2.3522 },
    city: 'Paris',
    country: 'France',
    placeTypes: ['locality', 'city'],
    source: 'mock',
  }),
  place({
    id: 'cdg-airport',
    labelEn: 'Charles de Gaulle Airport (CDG)',
    labelAr: 'مطار شارل ديغول',
    address: 'Roissy-en-France',
    coordinates: { lat: 49.0097, lng: 2.5479 },
    city: 'Paris',
    country: 'France',
    placeTypes: ['airport'],
    source: 'mock',
  }),
  place({
    id: 'dubai-marina',
    labelEn: 'Dubai Marina',
    labelAr: 'دبي مارينا',
    address: 'Dubai Marina, UAE',
    coordinates: { lat: 25.0805, lng: 55.1403 },
    city: 'Dubai',
    country: 'UAE',
    placeTypes: ['neighborhood'],
    source: 'mock',
  }),
  place({
    id: 'dxb-airport',
    labelEn: 'Dubai International Airport (DXB)',
    labelAr: 'مطار دبي الدولي',
    address: 'Dubai, UAE',
    coordinates: { lat: 25.2532, lng: 55.3657 },
    city: 'Dubai',
    country: 'UAE',
    placeTypes: ['airport'],
    source: 'mock',
  }),
]

export function findMockPlaces(query: string): MapPlace[] {
  const key = query.trim().toLowerCase()
  if (!key) return []
  return MOCK_PLACES.filter((p) =>
    p.id.includes(key)
    || p.labelEn.toLowerCase().includes(key)
    || p.labelAr.includes(query.trim())
    || (p.city?.toLowerCase().includes(key) ?? false)
    || (p.address?.toLowerCase().includes(key) ?? false)
    || p.placeTypes.some((t) => t.includes(key)),
  )
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
