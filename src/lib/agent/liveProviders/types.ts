/**
 * Sprint 56 — Live Provider SDK contracts.
 * Providers return structured data only. Ranking stays in Booking Intelligence.
 * Conversation Brain remains the sole author of traveler-facing language.
 */

export type LiveProviderId = 'amadeus' | 'duffel' | 'booking' | 'simulated'

export type LiveSearchDomain =
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'cars'
  | 'transfers'
  | 'insurance'
  | 'airports'

export interface LiveMoney {
  amount: number
  currency: string
}

export interface LiveFlightOffer {
  id: string
  providerId: LiveProviderId
  from: string
  to: string
  airline: string | null
  cabin: string | null
  stops: number
  durationMinutes: number | null
  departureAt: string | null
  arrivalAt: string | null
  price: LiveMoney
  refundable: boolean | null
  raw?: unknown
}

export interface LiveHotelOffer {
  id: string
  providerId: LiveProviderId
  name: string
  area: string | null
  stars: number | null
  rating: number | null
  nightly: LiveMoney
  photos: string[]
  latitude: number | null
  longitude: number | null
  refundable: boolean | null
  raw?: unknown
}

export interface LiveActivityOffer {
  id: string
  providerId: LiveProviderId
  title: string
  price: LiveMoney
  rating: number | null
  location: string | null
  raw?: unknown
}

export interface LiveCarOffer {
  id: string
  providerId: LiveProviderId
  title: string
  price: LiveMoney
  category: string | null
  raw?: unknown
}

export interface LiveTransferOffer {
  id: string
  providerId: LiveProviderId
  title: string
  price: LiveMoney
  durationMinutes: number | null
  raw?: unknown
}

export interface LiveInsuranceOffer {
  id: string
  providerId: LiveProviderId
  title: string
  price: LiveMoney
  coverage: string | null
  raw?: unknown
}

export interface LiveAirportResult {
  iata: string
  name: string
  city: string | null
  country: string | null
}

export interface LiveFlightSearchInput {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  adults?: number
  currency?: string
  signal?: AbortSignal
}

export interface LiveHotelSearchInput {
  destination: string
  checkIn: string
  checkOut?: string | null
  adults?: number
  currency?: string
  signal?: AbortSignal
}

export interface LiveGenericSearchInput {
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  travelers?: number
  currency?: string
  signal?: AbortSignal
}

export interface LiveProviderCapabilities {
  flights: boolean
  hotels: boolean
  activities: boolean
  cars: boolean
  transfers: boolean
  insurance: boolean
  airports: boolean
}

export interface LiveProviderSdk {
  readonly providerId: LiveProviderId
  readonly displayName: string
  readonly capabilities: LiveProviderCapabilities
  isAvailable(): boolean
  searchFlights?(input: LiveFlightSearchInput): Promise<LiveFlightOffer[]>
  searchHotels?(input: LiveHotelSearchInput): Promise<LiveHotelOffer[]>
  searchActivities?(input: LiveGenericSearchInput): Promise<LiveActivityOffer[]>
  searchCars?(input: LiveGenericSearchInput): Promise<LiveCarOffer[]>
  searchTransfers?(input: LiveGenericSearchInput): Promise<LiveTransferOffer[]>
  searchInsurance?(input: LiveGenericSearchInput): Promise<LiveInsuranceOffer[]>
  searchAirports?(query: string, signal?: AbortSignal): Promise<LiveAirportResult[]>
  /** Optional flight-offer pricing / details hooks (Amadeus / Duffel). */
  getOfferDetails?(offerId: string, signal?: AbortSignal): Promise<LiveFlightOffer | LiveHotelOffer | null>
  priceOffer?(offerId: string, signal?: AbortSignal): Promise<LiveMoney | null>
  createOrder?(offerId: string, signal?: AbortSignal): Promise<{ ok: boolean; orderId?: string; error?: string }>
  cancelOrder?(orderId: string, signal?: AbortSignal): Promise<{ ok: boolean; error?: string }>
}

export interface LiveProviderHealth {
  providerId: LiveProviderId
  healthy: boolean
  disabled: boolean
  latencyMsAvg: number
  uptimeRatio: number
  failureCount: number
  successCount: number
  quotaRemaining: number | null
  qualityScore: number
  lastError: string | null
  updatedAt: string
}

export interface LiveProviderMetricsSnapshot {
  apiLatencyMs: Record<string, number>
  providerFailures: Record<string, number>
  cacheHitRatio: number
  searchDurationMs: number
  rankingDurationMs: number
  bookingReadinessTrue: number
  bookingReadinessFalse: number
  requests: number
  cacheHits: number
  cacheMisses: number
}

export type LiveFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>
