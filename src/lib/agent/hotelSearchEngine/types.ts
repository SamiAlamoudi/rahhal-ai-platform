/**
 * Sprint 73 — Hotel Search Engine contracts.
 */

import type { ProviderRuntimeId, ProviderRuntimeMode } from '../providerRuntime/types'

/** Includes future-ready Hotelbeds without changing Provider Runtime. */
export type HotelProviderId = ProviderRuntimeId | 'hotelbeds'

export type HotelSortMode =
  | 'recommended'
  | 'lowest_price'
  | 'highest_rating'
  | 'nearest'
  | 'stars'

export interface HotelCoordinates {
  latitude: number
  longitude: number
}

export interface UnifiedHotel {
  hotelId: string
  provider: HotelProviderId
  hotelName: string
  city: string
  country: string
  coordinates: HotelCoordinates | null
  stars: number
  rating: number
  reviewCount: number
  images: string[]
  amenities: string[]
  roomTypes: string[]
  boardType: string
  pricePerNight: number
  currency: string
  totalPrice: number
  taxes: number
  refundable: boolean
  freeCancellation: boolean
  breakfastIncluded: boolean
  bookingToken: string
  providerMetadata: Record<string, unknown>
  /** Distance from search center in km (nearby searches). */
  distanceKm?: number | null
  /** Ranking score (higher is better). */
  score?: number
}

export interface HotelSearchFilters {
  minPrice?: number
  maxPrice?: number
  minStars?: number
  maxStars?: number
  minRating?: number
  maxDistanceKm?: number
  amenities?: string[]
  breakfastIncluded?: boolean
  refundableOnly?: boolean
  freeCancellationOnly?: boolean
}

export interface HotelSearchRequest {
  city?: string
  destination?: string
  hotelId?: string
  checkIn?: string
  checkOut?: string | null
  adults?: number
  /** Integration Sprint 3 — children count for live providers. */
  children?: number
  rooms?: number
  currency?: string
  /** Center for nearby search. */
  latitude?: number
  longitude?: number
  radiusKm?: number
  filters?: HotelSearchFilters
  sort?: HotelSortMode
  pageSize?: number
  cursor?: string | null
  signal?: AbortSignal
  parallel?: boolean
  timeoutMs?: number
}

export interface HotelSearchDiagnostics {
  requestId: string
  providersUsed: HotelProviderId[]
  providerLatencyMs: Partial<Record<HotelProviderId, number>>
  cacheHit: boolean
  fallbackUsed: boolean
  modes: Partial<Record<HotelProviderId, ProviderRuntimeMode | 'future'>>
  totalBeforeFilter: number
  totalAfterFilter: number
  totalAfterDedupe: number
  gracefulMessage?: string
}

export interface HotelSearchPage {
  hotels: UnifiedHotel[]
  nextCursor: string | null
  hasMore: boolean
  total: number
  diagnostics: HotelSearchDiagnostics
}

export const SPRINT73_HOTEL_SEARCH_VERSION = '1.0.0-hotels'
