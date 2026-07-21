/**
 * Sprint 73 — Hotel search filters.
 */

import type { HotelSearchFilters, UnifiedHotel } from './types'

export function applyHotelFilters(
  hotels: UnifiedHotel[],
  filters?: HotelSearchFilters,
): UnifiedHotel[] {
  if (!filters) return hotels
  return hotels.filter((h) => {
    if (filters.minPrice != null && h.pricePerNight < filters.minPrice) return false
    if (filters.maxPrice != null && h.pricePerNight > filters.maxPrice) return false
    if (filters.minStars != null && h.stars < filters.minStars) return false
    if (filters.maxStars != null && h.stars > filters.maxStars) return false
    if (filters.minRating != null && h.rating < filters.minRating) return false
    if (filters.maxDistanceKm != null) {
      const d = h.distanceKm ?? Infinity
      if (d > filters.maxDistanceKm) return false
    }
    if (filters.amenities?.length) {
      const set = new Set(h.amenities.map((a) => a.toLowerCase()))
      for (const a of filters.amenities) {
        if (!set.has(a.toLowerCase())) return false
      }
    }
    if (filters.breakfastIncluded && !h.breakfastIncluded) return false
    if (filters.refundableOnly && !h.refundable) return false
    if (filters.freeCancellationOnly && !h.freeCancellation) return false
    return true
  })
}
