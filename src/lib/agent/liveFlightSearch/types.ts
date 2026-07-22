/**
 * Sprint 105 — Live Flight Search contracts (Rahhal-internal only).
 */

export const SPRINT105_LIVE_FLIGHT_SEARCH_VERSION = '1.0.0-live-flight-search'

export type LiveFlightCabin =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first'

export interface LiveFlightSearchCriteria {
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
  timeoutMs?: number
  signal?: AbortSignal
}

/** Rahhal flight offer for Decision Engine / conversation — never Amadeus-specific. */
export interface RahhalFlightSearchOffer {
  id: string
  providerId: string
  airline: string | null
  carrierCode: string | null
  price: number | null
  currency: string
  durationMinutes: number | null
  stops: number | null
  cabin: string | null
  origin: string
  destination: string
  departureAt: string | null
  arrivalAt: string | null
  refundable: boolean
  seatsRemaining: number | null
  providerConfidence: number
  availability: string | null
  title: string
}

export interface LiveFlightSearchError {
  code: string
  message: string
  retryable: boolean
  rateLimited: boolean
  timedOut: boolean
  httpStatus: number | null
}

export interface LiveFlightSearchLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export interface LiveFlightSearchResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  flights: RahhalFlightSearchOffer[]
  /** Decision-engine-ready offer records (no provider SDK objects). */
  flightOffers: Record<string, unknown>[]
  latencyMs: number
  attempts: number
  error: LiveFlightSearchError | null
  validationErrors: string[]
  logs: string[]
  meta: {
    origin: string | null
    destination: string | null
    departureDate: string | null
    adults: number | null
    children: number | null
    currency: string | null
    providerId: string | null
    maxResults: number | null
    nonStop: boolean | null
  }
}

export type LiveFlightSearchStructuredLogger = (entry: LiveFlightSearchLogEntry) => void

export function createSilentLiveFlightSearchLogger(): LiveFlightSearchStructuredLogger {
  return () => {
    /* logs retained on runner */
  }
}
