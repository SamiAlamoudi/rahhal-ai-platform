/**
 * Sprint 73 — Deduplicate hotels across providers; keep highest confidence.
 */

import type { UnifiedHotel } from './types'

function hotelKey(hotel: UnifiedHotel): string {
  const name = hotel.hotelName.toLowerCase().replace(/\s+/g, ' ').trim()
  const city = hotel.city.toLowerCase().trim()
  if (hotel.coordinates) {
    const lat = hotel.coordinates.latitude.toFixed(3)
    const lon = hotel.coordinates.longitude.toFixed(3)
    return `${name}|${city}|${lat}|${lon}`
  }
  return `${name}|${city}`
}

function confidence(hotel: UnifiedHotel): number {
  if (typeof hotel.score === 'number') return hotel.score
  if (hotel.provider === 'booking') return 0.95
  if (hotel.provider === 'hotelbeds') return 0.9
  return 0.55
}

export function dedupeHotels(hotels: UnifiedHotel[]): UnifiedHotel[] {
  const best = new Map<string, UnifiedHotel>()
  for (const hotel of hotels) {
    const key = hotelKey(hotel)
    const existing = best.get(key)
    if (!existing || confidence(hotel) > confidence(existing)) {
      best.set(key, hotel)
    } else if (
      confidence(hotel) === confidence(existing)
      && hotel.pricePerNight < existing.pricePerNight
    ) {
      best.set(key, hotel)
    }
  }
  return [...best.values()]
}
