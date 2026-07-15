import type { HotelOffer } from '../../../../../utils/contracts/models/hotel'
import type { NormalizedOffer } from '../../types'

/**
 * Map Booking.com HotelOffer records into agent NormalizedOffer payloads.
 * Tool merge expects: name, area, category, nightly, nights, currency, …
 * Booking-specific objects never leave this module.
 */
export function hotelOffersToNormalizedOffers(
  offers: HotelOffer[],
  providerId: string,
  nights: number,
): NormalizedOffer[] {
  const safeNights = Math.max(1, nights)
  return offers.map((offer, index) => {
    const nightly = deriveNightly(offer.price, safeNights)
    const area = offer.area || offer.location || 'City center'
    const category = mapCategory(offer.hotelStars)
    const fingerprint = [
      'hotel',
      area.toLowerCase(),
      offer.id || index,
      Math.round(nightly / 20),
    ].join(':')

    return {
      domain: 'hotels',
      fingerprint,
      title: offer.title,
      price: nightly,
      currency: offer.currency || 'USD',
      providerId,
      confidence: 0.86,
      rankScore: 0,
      scoreHints: {
        priceCompetitiveness: clamp01(1 - nightly / 500),
        rating: offer.rating != null ? clamp01(offer.rating / 10) : clamp01(offer.hotelStars / 5),
        relevance: 0.9 - index * 0.02,
      },
      payload: {
        name: offer.title,
        area,
        category,
        nightly,
        nights: safeNights,
        total: Math.round(nightly * safeNights * 100) / 100,
        currency: offer.currency || 'USD',
        score: offer.rating ?? offer.hotelStars ?? null,
        source: 'booking',
        id: offer.id,
        breakfastIncluded: offer.breakfastIncluded,
        freeCancellation: offer.freeCancellation,
        checkIn: offer.checkIn,
        checkOut: offer.checkOut,
      },
    }
  })
}

function deriveNightly(totalOrNightly: number, nights: number): number {
  if (!Number.isFinite(totalOrNightly) || totalOrNightly <= 0) return 0
  // Booking product_price is often a stay total; prefer per-night for TripPlan stay cards.
  if (nights > 1 && totalOrNightly > 400) {
    return Math.round((totalOrNightly / nights) * 100) / 100
  }
  return Math.round(totalOrNightly * 100) / 100
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
