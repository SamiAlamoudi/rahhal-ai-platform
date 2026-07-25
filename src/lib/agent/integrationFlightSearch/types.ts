/**
 * Integration Sprint 2 — Live Flight Search conversation bridge contracts.
 * Additive. Provider-agnostic. Never expose raw Amadeus JSON to travelers.
 */

export const INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION = '1.0.0-integration-flight-search'

export type DepartureTimeWindow = 'morning' | 'afternoon' | 'evening' | 'night'

export type FlightRankReasonCode =
  | 'price'
  | 'duration'
  | 'stops'
  | 'convenience'
  | 'preferred_airline'
  | 'refundable'
  | 'baggage'
  | 'cabin_match'

export interface FlightRankReason {
  code: FlightRankReasonCode
  labelAr: string
  labelEn: string
  weight: number
}

export interface RankedConversationFlight {
  id: string
  providerId: string
  airline: string | null
  flightNumber: string | null
  origin: string
  destination: string
  departureAt: string | null
  arrivalAt: string | null
  durationMinutes: number | null
  stops: number | null
  cabin: string | null
  fareFamily: string | null
  price: number | null
  currency: string
  baggage: string | null
  refundable: boolean
  score: number
  reasons: FlightRankReason[]
  whyAr: string
  whyEn: string
}

export interface ConversationFlightSearchResult {
  version: string
  usedLive: boolean
  cacheHit: boolean
  empty: boolean
  gracefulMessage?: string
  offers: RankedConversationFlight[]
  highlights: {
    best: string | null
    cheapest: string | null
    fastest: string | null
  }
  consultantSummaryAr: string
  consultantSummaryEn: string
  diagnostics: {
    providerId: string | null
    latencyMs: number
    adults: number
    children: number
    cabin: string | null
    currency: string
    origin: string
    destination: string
    departureDate: string
    returnDate: string | null
    timezone: string | null
  }
}
