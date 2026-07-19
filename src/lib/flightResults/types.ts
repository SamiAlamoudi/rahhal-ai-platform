/**
 * Sprint 11 — Flight Results Experience domain types.
 * Provider-agnostic view of NormalizedTravelOption flights.
 */

import type { CabinClass, FlightSegment } from '../../utils/contracts/models/flight'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'

export type FlightSortKey =
  | 'best'
  | 'cheapest'
  | 'fastest'
  | 'earliest_departure'
  | 'latest_departure'

export type TimeOfDayWindow = 'any' | 'morning' | 'afternoon' | 'evening'

export interface FlightFilterState {
  maxPrice: number | null
  stops: 'any' | 'nonstop' | 'max1' | 'max2'
  airlines: string[]
  cabin: CabinClass | 'any'
  departureWindow: TimeOfDayWindow
  arrivalWindow: TimeOfDayWindow
}

export interface FlightResultViewModel {
  id: string
  option: NormalizedTravelOption
  airlineName: string
  airlineCode: string
  logoUrl: string | null
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  durationMinutes: number | null
  stops: number | null
  cabin: string
  price: number
  currency: string
  segments: FlightSegment[]
  baggageIncluded: boolean | null
  refundable: boolean | null
  cancellationPolicy: string | null
  fareFamily: string | null
  bookingClass: string | null
  aircraft: string | null
}

export function emptyFlightFilters(): FlightFilterState {
  return {
    maxPrice: null,
    stops: 'any',
    airlines: [],
    cabin: 'any',
    departureWindow: 'any',
    arrivalWindow: 'any',
  }
}
