/**
 * Sprint 30 — Map NormalizedHotelResult → Phase W aggregation NormalizedOffer.
 */

import type { NormalizedOffer } from '../../agent/aggregation/types'
import type { NormalizedHotelResult } from '../types'

export function toAggregationHotelOffers(
  offers: NormalizedHotelResult[],
  nights?: number,
): NormalizedOffer[] {
  return offers.map((offer, index) => {
    const safeNights = Math.max(1, nights ?? offer.nights)
    const nightly = offer.nightly
    const area = offer.area || offer.location || 'City center'
    return {
      domain: 'hotels' as const,
      fingerprint: [
        'hotel',
        area.toLowerCase(),
        offer.id || index,
        Math.round(nightly / 20),
      ].join(':'),
      title: offer.name,
      price: nightly,
      currency: offer.currency,
      providerId: String(offer.providerId),
      confidence: 0.88,
      rankScore: 0,
      scoreHints: {
        priceCompetitiveness: clamp01(1 - nightly / 500),
        rating: offer.guestReviews.score != null
          ? clamp01(offer.guestReviews.score / 10)
          : clamp01(offer.starRating / 5),
        relevance: 0.9 - index * 0.02,
      },
      payload: {
        name: offer.name,
        area,
        category: mapCategory(offer.starRating),
        nightly,
        nights: safeNights,
        total: offer.price,
        currency: offer.currency,
        score: offer.guestReviews.score ?? offer.starRating,
        stars: offer.starRating,
        source: String(offer.providerId),
        id: offer.id,
        breakfastIncluded: offer.breakfastIncluded,
        freeCancellation: offer.cancellation.freeCancellation,
        checkIn: offer.checkIn,
        checkOut: offer.checkOut,
        amenities: offer.amenities,
        images: offer.images.map((i) => i.url),
        taxesAndFees: offer.taxesAndFees,
        cancellation: offer.cancellation,
        guestReviews: offer.guestReviews,
        rooms: offer.rooms,
        sandbox: offer.sandbox,
      },
    }
  })
}

function mapCategory(stars: number): 'hotel' | 'resort' | 'apartment' | 'boutique' {
  if (stars >= 5) return 'resort'
  if (stars >= 4) return 'hotel'
  if (stars <= 2) return 'apartment'
  return 'boutique'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
