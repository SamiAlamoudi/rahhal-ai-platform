/**
 * Sprint 73 — Hotel ranking (price, rating, reviews, distance, stars, amenities, confidence).
 */

import type { UnifiedHotel } from './types'

function providerConfidence(hotel: UnifiedHotel): number {
  if (hotel.provider === 'booking') return 0.95
  if (hotel.provider === 'hotelbeds') return 0.9
  if (hotel.provider === 'amadeus') return 0.75
  return 0.55
}

function amenityScore(hotel: UnifiedHotel): number {
  const count = hotel.amenities.length
  return Math.min(1, count / 8)
}

export function scoreHotel(
  hotel: UnifiedHotel,
  cohort?: {
    minPrice: number
    maxPrice: number
    minRating: number
    maxRating: number
    minDistance: number
    maxDistance: number
  },
): number {
  const minPrice = cohort?.minPrice ?? hotel.pricePerNight
  const maxPrice = cohort?.maxPrice ?? hotel.pricePerNight
  const minRating = cohort?.minRating ?? hotel.rating
  const maxRating = cohort?.maxRating ?? hotel.rating
  const minDistance = cohort?.minDistance ?? hotel.distanceKm ?? 0
  const maxDistance = cohort?.maxDistance ?? hotel.distanceKm ?? 0

  const priceRange = Math.max(1, maxPrice - minPrice)
  const ratingRange = Math.max(0.1, maxRating - minRating)
  const distanceRange = Math.max(0.1, maxDistance - minDistance)
  const distance = hotel.distanceKm ?? maxDistance

  const priceScore = 1 - (hotel.pricePerNight - minPrice) / priceRange
  const ratingScore = (hotel.rating - minRating) / ratingRange
  const reviewScore = Math.min(1, hotel.reviewCount / 500)
  const distanceScore = 1 - (distance - minDistance) / distanceRange
  const starsScore = Math.min(1, hotel.stars / 5)
  const amenities = amenityScore(hotel)
  const confidence = providerConfidence(hotel)

  return (
    priceScore * 0.25
    + ratingScore * 0.2
    + reviewScore * 0.1
    + distanceScore * 0.15
    + starsScore * 0.1
    + amenities * 0.1
    + confidence * 0.1
  )
}

export function rankHotels(hotels: UnifiedHotel[]): UnifiedHotel[] {
  if (hotels.length === 0) return []
  const prices = hotels.map((h) => h.pricePerNight)
  const ratings = hotels.map((h) => h.rating)
  const distances = hotels.map((h) => h.distanceKm ?? 0)
  const cohort = {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minRating: Math.min(...ratings),
    maxRating: Math.max(...ratings),
    minDistance: Math.min(...distances),
    maxDistance: Math.max(...distances),
  }
  return hotels
    .map((h) => ({ ...h, score: scoreHotel(h, cohort) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
