/**
 * Sprint 92 — Amadeus Sandbox contracts (additive).
 */

export const SPRINT92_AMADEUS_SANDBOX_VERSION = '1.0.0-amadeus-sandbox'

export const AMADEUS_SANDBOX_PROVIDER_ID = 'amadeus' as const

export const AMADEUS_SANDBOX_DEFAULT_BASE_URL = 'https://test.api.amadeus.com'

/** Normalized Rahhal flight offer from Amadeus sandbox. */
export interface AmadeusNormalizedFlight {
  id: string
  providerId: typeof AMADEUS_SANDBOX_PROVIDER_ID
  airline: string | null
  airlineName: string | null
  origin: string
  destination: string
  price: number
  currency: string
  durationMinutes: number | null
  stops: number
  cabin: string | null
  departureAt: string | null
  arrivalAt: string | null
  refundable: boolean | null
  seatsRemaining: number | null
  availability: 'available' | 'limited' | 'unknown'
  passengers: {
    adults: number
    children: number
  }
  airports: {
    origin: { iata: string; name: string | null }
    destination: { iata: string; name: string | null }
  }
  metadata: {
    source: 'amadeus_sandbox'
    offerType: string | null
    rawId: string | null
  }
}

export interface AmadeusAirportLookup {
  iata: string
  name: string
  city: string | null
  country: string | null
}

export type AmadeusProviderEventName =
  | 'provider.request'
  | 'provider.response'
  | 'provider.failure'
  | 'provider.retry'
  | 'provider.success'
  | 'provider.latency'
  | 'provider.token.refresh'

export interface AmadeusProviderEvent {
  name: AmadeusProviderEventName
  at: string
  providerId: string
  detail?: Record<string, unknown>
}

export interface AmadeusSandboxConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  /** Never log secrets — presence only. */
  hasCredentials: boolean
}
