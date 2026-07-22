/**
 * Sprint 90 — Live Provider Integration Readiness (core contracts).
 * Infrastructure only — does not change AI engines or conversation.
 */

export const SPRINT90_PROVIDER_READINESS_VERSION = '1.0.0-live-provider-readiness'

/** Operating mode for a registered provider. */
export type ProviderMode = 'mock' | 'sandbox' | 'live'

export type ProviderPriorityTier = 'primary' | 'secondary' | 'fallback'

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export type ProviderDomain = 'flights' | 'hotels' | 'packages'

export interface ProviderLimits {
  maxRequestsPerMinute: number
  maxConcurrent: number
  timeoutMs: number
  maxRetries: number
}

export interface ProviderCapabilityMap {
  flights: boolean
  hotels: boolean
  packages: boolean
  booking: boolean
  cancellation: boolean
  sandbox: boolean
  live: boolean
}

export interface ProviderHealthResult {
  providerId: string
  ok: boolean
  mode: ProviderMode
  latencyMs: number
  detail: string
  checkedAt: string
}

export interface FlightSearchRequest {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  adults?: number
  /** Optional child passengers (Amadeus Flight Offers). */
  children?: number
  /** Cabin / travel class hint (economy, business, …). */
  cabin?: string | null
  currency?: string
  /** Cap offers returned by the provider (Amadeus `max`). */
  maxResults?: number
  /** Prefer non-stop itineraries when the provider supports it. */
  nonStop?: boolean
  signal?: AbortSignal
}

export interface HotelSearchRequest {
  destination: string
  checkIn: string
  checkOut?: string | null
  adults?: number
  children?: number
  rooms?: number
  currency?: string
  maxResults?: number
  signal?: AbortSignal
}

export interface PackageSearchRequest {
  origin?: string
  destination: string
  departureDate?: string
  checkIn?: string
  checkOut?: string | null
  adults?: number
  currency?: string
  signal?: AbortSignal
}

export interface ProviderSearchResult<T = Record<string, unknown>> {
  ok: boolean
  providerId: string
  mode: ProviderMode
  results: T[]
  partial: boolean
  empty: boolean
  latencyMs: number
  error?: string
  retryable?: boolean
}

/**
 * Every live-ready provider must expose this surface.
 * Implementations may be mock, sandbox, or live.
 */
export interface TravelProvider {
  readonly id: string
  readonly displayName: string
  readonly mode: ProviderMode
  health(signal?: AbortSignal): Promise<ProviderHealthResult>
  searchFlights(request: FlightSearchRequest): Promise<ProviderSearchResult>
  searchHotels(request: HotelSearchRequest): Promise<ProviderSearchResult>
  searchPackages(request: PackageSearchRequest): Promise<ProviderSearchResult>
  capabilities(): ProviderCapabilityMap
  limits(): ProviderLimits
}
