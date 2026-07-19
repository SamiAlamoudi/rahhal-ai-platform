/**
 * Sprint 30 — Map NormalizedHotelResult → contracts HotelOffer (additive).
 */

import type { HotelOffer, RoomType } from '../../../utils/contracts/models/hotel'
import type { NormalizedHotelResult } from '../types'

export function toContractHotelOffer(offer: NormalizedHotelResult): HotelOffer {
  const roomTypes: RoomType[] = offer.rooms.map((room) => ({
    name: room.name,
    capacity: room.capacity,
    bedType: room.bedType,
    count: Math.max(1, room.available),
  }))

  return {
    id: offer.id,
    providerId: String(offer.providerId),
    title: offer.name,
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    rating: offer.guestReviews.score,
    hotelStars: offer.starRating,
    location: offer.location,
    area: offer.area,
    checkIn: offer.checkIn,
    checkOut: offer.checkOut,
    familyFriendly: offer.familyFriendly,
    breakfastIncluded: offer.breakfastIncluded,
    freeCancellation: offer.cancellation.freeCancellation,
    amenities: [...offer.amenities],
    roomTypes,
    // Additive optional enrichment (Sprint 30)
    images: offer.images.map((i) => i.url),
    guestReviewCount: offer.guestReviews.count,
    guestReviewLabel: offer.guestReviews.label,
    taxesAndFeesTotal: offer.taxesAndFees.taxes + offer.taxesAndFees.fees,
    cancellationSummary: offer.cancellation.summary,
    nightly: offer.nightly,
    sandbox: offer.sandbox,
  }
}

export function toContractHotelOffers(offers: NormalizedHotelResult[]): HotelOffer[] {
  return offers.map(toContractHotelOffer)
}
