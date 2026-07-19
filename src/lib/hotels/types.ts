/**
 * Sprint 30 — Normalized hotel search model (provider-agnostic).
 * Additive to contracts HotelOffer / brain HotelSearchPayload.
 */

export type HotelProviderId =
  | 'hotelbeds'
  | 'expedia_rapid'
  | 'booking_connectivity'
  | 'mock_hotels'
  | (string & {})

export type HotelProviderMode = 'sandbox' | 'mock' | 'live'

export type HotelHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export type HotelProviderErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'unavailable'
  | 'not_configured'
  | 'invalid_input'
  | 'upstream_error'
  | 'empty'
  | 'aborted'
  | 'unknown'

export interface HotelGuestReviews {
  score: number | null
  count: number
  label: string | null
}

export interface HotelTaxesAndFees {
  currency: string
  taxes: number
  fees: number
  totalInclusive: number
  /** Base / exclusive of taxes when known. */
  baseExclusive: number | null
  notes: string[]
}

export interface HotelCancellationPolicy {
  freeCancellation: boolean
  deadline: string | null
  penaltyAmount: number | null
  currency: string | null
  summary: string
}

export interface HotelRoomAvailability {
  roomId: string
  name: string
  bedType: string
  capacity: number
  available: number
  board: string | null
  nightly: number
  currency: string
  freeCancellation: boolean
  breakfastIncluded: boolean
}

export interface HotelImage {
  url: string
  caption: string | null
  isPrimary: boolean
}

export interface NormalizedHotelResult {
  id: string
  providerId: HotelProviderId
  name: string
  description: string | null
  currency: string
  /** Stay total when known; otherwise nightly * nights estimate. */
  price: number
  nightly: number
  originalPrice: number | null
  starRating: number
  guestReviews: HotelGuestReviews
  location: string
  area: string | null
  latitude: number | null
  longitude: number | null
  checkIn: string
  checkOut: string
  nights: number
  familyFriendly: boolean
  breakfastIncluded: boolean
  amenities: string[]
  images: HotelImage[]
  rooms: HotelRoomAvailability[]
  cancellation: HotelCancellationPolicy
  taxesAndFees: HotelTaxesAndFees
  bookingUrl: string | null
  sandbox: boolean
}

export interface HotelSearchRequest {
  destination: string
  checkIn: string
  checkOut: string
  adults: number
  children?: number
  rooms?: number
  currency?: string
  locale?: string
  /** Preferred hotel brands from conversation memory / orchestrator. */
  preferredHotels?: string[]
  maxResults?: number
  signal?: AbortSignal
}

export interface HotelRoomAvailabilityRequest {
  hotelId: string
  checkIn: string
  checkOut: string
  adults: number
  children?: number
  currency?: string
  signal?: AbortSignal
}

export interface HotelPricingRequest {
  hotelId: string
  roomId?: string
  checkIn: string
  checkOut: string
  adults: number
  currency?: string
  signal?: AbortSignal
}

export interface HotelProviderError {
  code: HotelProviderErrorCode
  message: string
  retryable: boolean
  retryAfterMs?: number
}

export interface HotelProviderResult<T> {
  providerId: HotelProviderId
  providerName: string
  success: boolean
  latencyMs: number
  fromCache: boolean
  data: T | null
  errors: HotelProviderError[]
  warnings: string[]
  sandbox: boolean
}

export interface HotelProviderCapabilities {
  providerId: HotelProviderId
  search: boolean
  roomAvailability: boolean
  pricing: boolean
  cancellationPolicy: boolean
  taxesAndFees: boolean
  images: boolean
  amenities: boolean
  starRating: boolean
  guestReviews: boolean
  sandboxOnly: boolean
  rateLimitPerMinute: number
}

export interface HotelProviderMetadata {
  id: HotelProviderId
  displayName: string
  priority: number
  reliability: number
  mode: HotelProviderMode
  version: string
}

export interface HotelHealthSnapshot {
  providerId: HotelProviderId
  status: HotelHealthStatus
  consecutiveFailures: number
  consecutiveSuccesses: number
  totalRequests: number
  totalSuccesses: number
  totalFailures: number
  lastLatencyMs: number | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorCode: HotelProviderErrorCode | null
  rateLimitedUntil: string | null
}

export interface HotelProviderMetricsSnapshot {
  providerId: HotelProviderId
  requests: number
  successes: number
  failures: number
  timeouts: number
  rateLimited: number
  retries: number
  cacheHits: number
  cacheMisses: number
  fallbacks: number
  totalLatencyMs: number
  avgLatencyMs: number
}

export interface HotelSearchOptions {
  /** Ordered provider ids; defaults to registry priority order. */
  providerChain?: HotelProviderId[]
  /** Skip cache read/write. */
  bypassCache?: boolean
  /** Per-attempt timeout. */
  timeoutMs?: number
  /** Max retry attempts per provider (in addition to first try). */
  maxRetries?: number
  /** Prefer failover across providers on empty/error. */
  failover?: boolean
}

export interface HotelUnifiedSearchResult {
  offers: NormalizedHotelResult[]
  providerId: HotelProviderId
  providerName: string
  latencyMs: number
  fromCache: boolean
  sandbox: boolean
  fallbackCount: number
  attempts: Array<{
    providerId: HotelProviderId
    success: boolean
    latencyMs: number
    errorCode?: HotelProviderErrorCode
  }>
}
