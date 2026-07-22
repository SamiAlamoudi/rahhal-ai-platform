/**
 * Sprint 104 — Provider Gateway contracts (unified request/response).
 * Additive — wraps existing TravelProvider surface; does not redesign engines.
 */

export const SPRINT104_PROVIDER_GATEWAY_VERSION = '1.0.0-live-provider-gateway'

export type GatewayProviderId = 'amadeus' | 'duffel' | 'booking_com'

export type GatewayOperation =
  | 'health'
  | 'search_flights'
  | 'search_hotels'
  | 'search_packages'

export type GatewayProviderStatus =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'disabled'

export interface GatewayProviderDescriptor {
  id: GatewayProviderId
  displayName: string
  /** Phase 1: only Amadeus is enabled for live gateway traffic. */
  phase1Enabled: boolean
  travelProviderId: string
}

export interface GatewayFlightSearchInput {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  adults?: number
  children?: number
  cabin?: string | null
  currency?: string
  maxResults?: number
  nonStop?: boolean
}

export interface GatewayHotelSearchInput {
  destination: string
  checkIn: string
  checkOut?: string | null
  adults?: number
  currency?: string
}

export interface GatewayPackageSearchInput {
  destination: string
  origin?: string
  departureDate?: string
  checkIn?: string
  checkOut?: string | null
  adults?: number
  currency?: string
}

export interface GatewayRequest {
  operation: GatewayOperation
  providerId?: GatewayProviderId | null
  flight?: GatewayFlightSearchInput | null
  hotel?: GatewayHotelSearchInput | null
  package?: GatewayPackageSearchInput | null
  timeoutMs?: number
  signal?: AbortSignal
}

export interface GatewayOffer {
  id: string
  providerId: GatewayProviderId
  kind: 'flight' | 'hotel' | 'package'
  title: string
  price: number | null
  currency: string
  raw: Record<string, unknown>
}

export interface GatewayErrorView {
  code: string
  message: string
  retryable: boolean
  providerId: string | null
  rateLimited: boolean
  timedOut: boolean
}

export interface GatewayResponse {
  version: string
  enabled: boolean
  operation: GatewayOperation
  providerId: GatewayProviderId | null
  ok: boolean
  offers: GatewayOffer[]
  empty: boolean
  partial: boolean
  latencyMs: number
  attempts: number
  error: GatewayErrorView | null
  logs: string[]
}

export interface GatewayLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  providerId?: string
  operation?: GatewayOperation
  meta?: Record<string, unknown>
}

export type GatewayStructuredLogger = (entry: GatewayLogEntry) => void

export function createSilentGatewayLogger(): GatewayStructuredLogger {
  return () => {
    /* structured logs retained on the gateway instance */
  }
}

export function createCollectingGatewayLogger(
  sink: GatewayLogEntry[],
): GatewayStructuredLogger {
  return (entry) => {
    sink.push(entry)
  }
}
