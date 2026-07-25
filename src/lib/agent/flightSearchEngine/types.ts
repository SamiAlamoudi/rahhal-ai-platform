/**
 * Sprint 72 — Flight Search Engine contracts.
 */

import type { ProviderRuntimeId, ProviderRuntimeMode } from '../providerRuntime/types'

export type FlightTripType = 'one_way' | 'round_trip' | 'multi_city'

export type FlightCabinClass =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first'

export type FlightSortMode =
  | 'recommendation'
  | 'lowest_price'
  | 'shortest_duration'
  | 'earliest_departure'
  | 'earliest_arrival'

export interface FlightLegRequest {
  origin: string
  destination: string
  departureDate: string
}

export interface UnifiedFlight {
  id: string
  provider: ProviderRuntimeId
  airline: string
  flightNumber: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  duration: number
  stops: number
  cabin: FlightCabinClass
  fareFamily: string
  price: number
  currency: string
  baggage: string | null
  refundable: boolean
  bookingToken: string
  providerMetadata: Record<string, unknown>
  /** Ranking score (higher is better). */
  score?: number
}

export interface FlightSearchFilters {
  minPrice?: number
  maxPrice?: number
  airlines?: string[]
  maxStops?: number
  cabin?: FlightCabinClass | FlightCabinClass[]
  departureTimeFrom?: string
  departureTimeTo?: string
  arrivalTimeFrom?: string
  arrivalTimeTo?: string
  maxDurationMinutes?: number
  refundableOnly?: boolean
  baggageIncluded?: boolean
}

export interface FlightSearchRequest {
  tripType?: FlightTripType
  origin?: string
  destination?: string
  departureDate?: string
  returnDate?: string | null
  legs?: FlightLegRequest[]
  adults?: number
  /** Integration Sprint 2 — children (0+); forwarded to live providers. */
  children?: number
  currency?: string
  preferredAirlines?: string[]
  cabin?: FlightCabinClass
  filters?: FlightSearchFilters
  sort?: FlightSortMode
  pageSize?: number
  cursor?: string | null
  signal?: AbortSignal
  /** Prefer parallel provider fan-out (default true). */
  parallel?: boolean
  timeoutMs?: number
}

export interface FlightSearchDiagnostics {
  requestId: string
  providersUsed: ProviderRuntimeId[]
  providerLatencyMs: Partial<Record<ProviderRuntimeId, number>>
  cacheHit: boolean
  fallbackUsed: boolean
  modes: Partial<Record<ProviderRuntimeId, ProviderRuntimeMode>>
  totalBeforeFilter: number
  totalAfterFilter: number
  totalAfterDedupe: number
  gracefulMessage?: string
}

export interface FlightSearchPage {
  flights: UnifiedFlight[]
  nextCursor: string | null
  hasMore: boolean
  total: number
  diagnostics: FlightSearchDiagnostics
}

export const SPRINT72_FLIGHT_SEARCH_VERSION = '1.0.0-flights'
