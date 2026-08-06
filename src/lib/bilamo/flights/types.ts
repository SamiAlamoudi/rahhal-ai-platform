/**
 * Bilamo Live Flights — provider-neutral contracts.
 * Vendor payloads stay inside adapters; UI never consumes raw Amadeus/Duffel JSON.
 */

export const BILAMO_FLIGHTS_VERSION = '1.0.0-live-flights-slice'

export type FlightCabinClass =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first'

export type FlightProviderMode = 'demo' | 'live'

export type FlightProviderId = 'demo' | 'amadeus' | 'unknown'

export interface BilamoFlightSearchRequest {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string | null
  adults: number
  children?: number
  infants?: number
  cabin?: FlightCabinClass | null
  directOnly?: boolean
  preferredAirlines?: string[]
  maxStops?: number | null
  currency?: string | null
  signal?: AbortSignal
  /** Internal: force mode for tests. */
  forceMode?: FlightProviderMode
}

export interface FlightLayover {
  airport: string
  durationMinutes: number
}

export interface NormalizedFlightOffer {
  offerId: string
  airline: string
  flightNumber: string | null
  origin: string
  destination: string
  departAt: string
  arriveAt: string
  durationMinutes: number
  stops: number
  layovers: FlightLayover[]
  cabin: FlightCabinClass
  baggageSummary: string | null
  refundable: boolean | null
  changeable: boolean | null
  totalPrice: number
  currency: string
  provider: FlightProviderId
  bookingReference: string | null
  deepLink: string | null
  fetchedAt: string
  /** Internal only — never shown as a user-facing “mock” label. */
  meta: {
    demo: boolean
    dataSource: 'demo' | 'live'
  }
}

export interface FlightOfferDetails {
  offer: NormalizedFlightOffer
  segments: Array<{
    airline: string
    flightNumber: string | null
    origin: string
    destination: string
    departAt: string
    arriveAt: string
    durationMinutes: number
  }>
}

export interface FlightProviderHealth {
  ok: boolean
  mode: FlightProviderMode
  provider: FlightProviderId
  detail: string
  checkedAt: string
}

export type FlightRecommendationKind = 'best' | 'cheapest' | 'fastest'

export interface ScoredFlightOffer {
  offer: NormalizedFlightOffer
  score: number
  kind: FlightRecommendationKind | null
  reason: string
  breakdown: {
    price: number
    duration: number
    stops: number
    layover: number
    schedule: number
    airline: number
    baggage: number
    direct: number
  }
}

export interface FlightRecommendationSet {
  best: ScoredFlightOffer
  cheapest: ScoredFlightOffer
  fastest: ScoredFlightOffer
  /** Deduped display order: best, then cheapest/fastest if distinct. */
  display: ScoredFlightOffer[]
  mode: FlightProviderMode
  stale: boolean
  error: string | null
}

export interface FlightSearchProviderResult {
  ok: boolean
  mode: FlightProviderMode
  offers: NormalizedFlightOffer[]
  error: string | null
  timedOut: boolean
  rateLimited: boolean
  latencyMs: number
}
