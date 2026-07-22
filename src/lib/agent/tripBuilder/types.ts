/**
 * Sprint 110 — AI Trip Builder contracts.
 * Combines live flight + hotel offers into complete trip recommendations.
 */

import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import type {
  ResponseComposerFlightFacts,
  ResponseComposerInput,
} from '../responseComposer/types'

export const SPRINT110_TRIP_BUILDER_VERSION = '1.0.0-trip-builder'

export type TripRankKind =
  | 'best_overall'
  | 'best_budget'
  | 'best_luxury'
  | 'best_family'
  | 'best_business'
  | 'best_value'
  | 'best_short_stay'
  | 'best_long_stay'

export interface TripBuilderPreferences {
  cabin?: string | null
  family?: boolean
  business?: boolean
  luxury?: boolean
  budgetConscious?: boolean
  maxStops?: number | null
  minHotelStars?: number | null
}

export interface TripBuilderProviderSignal {
  code: string
  message: string
  retryable?: boolean
}

/**
 * Input accepts Live Flight Search + Live Hotel Search offer shapes
 * plus traveler constraints. Does not call providers itself.
 */
export interface TripBuilderInput {
  flights?: RahhalFlightSearchOffer[] | null
  hotels?: HotelOffer[] | null
  destination: string
  departureDate: string
  returnDate?: string | null
  /** Defaults to departureDate when omitted. */
  checkInDate?: string | null
  /** Defaults to returnDate (or departureDate + 1 night) when omitted. */
  checkOutDate?: string | null
  budget?: number | null
  currency?: string
  adults?: number
  children?: number
  preferences?: TripBuilderPreferences | null
  /** Cap on flight×hotel combinations after ranking (default 36). */
  maxCandidates?: number
  conversationId?: string | null
  /** Optional upstream failure signals (empty pools / provider errors). */
  flightSearchError?: TripBuilderProviderSignal | null
  hotelSearchError?: TripBuilderProviderSignal | null
}

export interface TripCostBreakdown {
  flightCost: number
  hotelCost: number
  taxes: number
  totalCost: number
  currency: string
  estimatedSavings: number | null
  underBudget: boolean | null
  budgetUtilization: number | null
}

export interface TripCandidate {
  id: string
  title: string
  destination: string
  departureDate: string
  returnDate: string | null
  checkInDate: string
  checkOutDate: string
  nights: number
  flight: RahhalFlightSearchOffer
  hotel: HotelOffer
  cost: TripCostBreakdown
  travelQuality: number
  confidence: number
  explanation: string
  reasons: string[]
  labels: TripRankKind[]
  compatible: boolean
  validationErrors: string[]
  score: number
}

export interface TripRankedGroup {
  kind: TripRankKind
  label: string
  trip: TripCandidate | null
}

export interface TripBuilderError {
  code: string
  message: string
  retryable: boolean
}

/**
 * Complete trip package for Response Composer consumers.
 * Response Composer itself stays flight-fact based; this package is the
 * additive carrier that callers flatten via `toResponseComposerInput`.
 */
export interface TripPackageForComposer {
  tripId: string
  title: string
  destination: string
  totalCost: number
  currency: string
  nights: number
  confidence: number
  explanation: string
  labels: TripRankKind[]
  flight: ResponseComposerFlightFacts
  hotel: {
    id: string
    hotelId: string
    hotelName: string
    price: number | null
    currency: string
    stars: number | null
    freeCancellation: boolean
    city: string | null
  }
  rankKind: TripRankKind | null
}

export interface TripBuilderResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  trips: TripCandidate[]
  ranked: TripCandidate[]
  rankings: TripRankedGroup[]
  selected: TripCandidate | null
  /**
   * Decision-engine-ready offer pools (trip-preferred order).
   * Decision Engine contracts are unchanged — consume these arrays as-is.
   */
  flightOffers: Record<string, unknown>[]
  hotelStays: Record<string, unknown>[]
  /** Complete trip packages for Response Composer pipeline. */
  responseComposerPackages: TripPackageForComposer[]
  /** Ready-made ResponseComposerInput (RC behavior unchanged). */
  responseComposerInput: ResponseComposerInput
  confidence: number
  error: TripBuilderError | null
  validationErrors: string[]
  logs: string[]
  latencyMs: number
  meta: {
    destination: string | null
    departureDate: string | null
    returnDate: string | null
    checkInDate: string | null
    checkOutDate: string | null
    budget: number | null
    currency: string | null
    flightCount: number
    hotelCount: number
    candidateCount: number
    conversationId: string | null
  }
}

export interface TripBuilderLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export type TripBuilderStructuredLogger = (entry: TripBuilderLogEntry) => void

export function createSilentTripBuilderLogger(): TripBuilderStructuredLogger {
  return () => {
    /* logs retained on runner */
  }
}
