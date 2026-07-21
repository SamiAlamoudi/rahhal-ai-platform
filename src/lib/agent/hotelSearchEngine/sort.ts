/**
 * Sprint 73 — Hotel result sorting.
 */

import type { HotelSortMode, UnifiedHotel } from './types'

export function sortHotels(
  hotels: UnifiedHotel[],
  mode: HotelSortMode = 'recommended',
): UnifiedHotel[] {
  const copy = [...hotels]
  switch (mode) {
    case 'lowest_price':
      return copy.sort((a, b) => a.pricePerNight - b.pricePerNight || b.rating - a.rating)
    case 'highest_rating':
      return copy.sort((a, b) => b.rating - a.rating || a.pricePerNight - b.pricePerNight)
    case 'nearest':
      return copy.sort(
        (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || a.pricePerNight - b.pricePerNight,
      )
    case 'stars':
      return copy.sort((a, b) => b.stars - a.stars || b.rating - a.rating)
    case 'recommended':
    default:
      return copy.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.pricePerNight - b.pricePerNight)
  }
}
