/**
 * Sprint 109 — Live Hotel Search contracts (Rahhal-internal only).
 */

export const SPRINT109_LIVE_HOTEL_SEARCH_VERSION = '1.0.0-live-hotel-search'

export type LiveHotelRankKind =
  | 'best_overall'
  | 'budget'
  | 'luxury'
  | 'business'
  | 'family'
  | 'closest_location'

export interface LiveHotelSearchCriteria {
  destination: string
  checkInDate: string
  checkOutDate: string
  adults?: number
  children?: number
  rooms?: number
  currency?: string
  maxResults?: number
  /** Optional reference point for closest-location ranking. */
  latitude?: number | null
  longitude?: number | null
  timeoutMs?: number
  signal?: AbortSignal
}

/** HotelOffer — Rahhal-internal; never Amadeus SDK objects. */
export interface HotelOffer {
  hotelId: string
  hotelName: string
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  roomType: string | null
  boardType: string | null
  rating: number | null
  stars: number | null
  price: number | null
  currency: string
  taxes: number | null
  freeCancellation: boolean
  amenities: string[]
  images: string[]
  provider: string
  /** Internal offer id for ranking / decision mapping. */
  id: string
}

export interface LiveHotelRankedGroup {
  kind: LiveHotelRankKind
  label: string
  offer: HotelOffer | null
}

export interface LiveHotelSearchError {
  code: string
  message: string
  retryable: boolean
  rateLimited: boolean
  timedOut: boolean
  httpStatus: number | null
}

export interface LiveHotelSearchLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export interface LiveHotelSearchResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  hotels: HotelOffer[]
  /** Decision-engine-ready hotel records (plain objects). */
  hotelOffers: Record<string, unknown>[]
  rankings: LiveHotelRankedGroup[]
  latencyMs: number
  attempts: number
  error: LiveHotelSearchError | null
  validationErrors: string[]
  logs: string[]
  meta: {
    destination: string | null
    checkInDate: string | null
    checkOutDate: string | null
    adults: number | null
    children: number | null
    rooms: number | null
    currency: string | null
    providerId: string | null
    maxResults: number | null
  }
}

export type LiveHotelSearchStructuredLogger = (entry: LiveHotelSearchLogEntry) => void

export function createSilentLiveHotelSearchLogger(): LiveHotelSearchStructuredLogger {
  return () => {
    /* logs retained on runner */
  }
}
