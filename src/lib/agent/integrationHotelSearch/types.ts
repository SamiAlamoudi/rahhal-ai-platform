/**
 * Integration Sprint 3 — Live Hotel Search conversation bridge contracts.
 */

export const INTEGRATION_LIVE_HOTEL_SEARCH_VERSION = '1.0.0-integration-hotel-search'

export type HotelRankReasonCode =
  | 'price'
  | 'rating'
  | 'location'
  | 'distance'
  | 'reviews'
  | 'amenities'
  | 'cancellation'
  | 'breakfast'
  | 'stars'
  | 'preference_match'

export interface HotelRankReason {
  code: HotelRankReasonCode
  labelAr: string
  labelEn: string
  weight: number
}

export interface RankedConversationHotel {
  id: string
  hotelId: string
  providerId: string
  hotelName: string
  city: string | null
  area: string | null
  stars: number | null
  rating: number | null
  reviewCount: number | null
  pricePerNight: number | null
  totalPrice: number | null
  currency: string
  roomType: string | null
  boardType: string | null
  breakfastIncluded: boolean
  freeCancellation: boolean
  refundable: boolean
  amenities: string[]
  images: string[]
  distanceKm: number | null
  score: number
  reasons: HotelRankReason[]
  whyAr: string
  whyEn: string
}

export interface ConversationHotelSearchResult {
  version: string
  usedLive: boolean
  cacheHit: boolean
  empty: boolean
  gracefulMessage?: string
  stays: RankedConversationHotel[]
  highlights: {
    best: string | null
    cheapest: string | null
    highestRated: string | null
  }
  consultantSummaryAr: string
  consultantSummaryEn: string
  diagnostics: {
    providerId: string | null
    latencyMs: number
    destination: string
    checkIn: string
    checkOut: string
    adults: number
    children: number
    rooms: number
    currency: string
  }
}
