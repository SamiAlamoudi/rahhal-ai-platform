/**
 * Sprint 93 — Unified Travel Intelligence contracts.
 * Presentation/composition only — no engine redesign.
 */

export const SPRINT93_UNIFIED_TRIP_VERSION = '1.0.0-unified-trip'

export interface TripTravelers {
  adults: number
  children: number
  total: number
  travelerType: string | null
}

export interface TripFlight {
  id: string
  direction: 'outbound' | 'return' | 'unknown'
  airline: string | null
  origin: string
  destination: string
  departureAt: string | null
  arrivalAt: string | null
  durationMinutes: number | null
  stops: number
  cabin: string | null
  price: number
  currency: string
  refundable: boolean | null
  providerId: string | null
  confidence: number
}

export interface TripHotel {
  id: string
  name: string
  destination: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  stars: number | null
  rating: number | null
  price: number
  currency: string
  providerId: string | null
  confidence: number
}

export interface TripActivity {
  id: string
  title: string
  startAt: string | null
  endAt: string | null
  price: number
  currency: string
  destination: string | null
  providerId: string | null
}

export interface TripTransfer {
  id: string
  title: string
  from: string | null
  to: string | null
  startAt: string | null
  durationMinutes: number | null
  price: number
  currency: string
  providerId: string | null
}

export interface TripInsurance {
  id: string
  title: string
  price: number
  currency: string
  coverage: string | null
  providerId: string | null
}

export interface TripVisa {
  id: string
  required: boolean
  destination: string | null
  summary: string
  estimatedFee: number
  currency: string
  providerId: string | null
}

export interface TripPricingSummary {
  flightCost: number
  hotelCost: number
  transferCost: number
  activityCost: number
  insuranceCost: number
  visaCost: number
  estimatedTaxes: number
  estimatedFees: number
  subtotal: number
  total: number
  currency: string
  budgetCap: number | null
  budgetDelta: number | null
}

export interface TripTimelineEvent {
  id: string
  kind:
    | 'flight_outbound'
    | 'arrival'
    | 'hotel_check_in'
    | 'activity'
    | 'transfer'
    | 'hotel_check_out'
    | 'flight_return'
    | 'other'
  title: string
  at: string | null
  endAt: string | null
  order: number
}

export interface TripSummary {
  executive: string
  traveler: string
  budget: string
  recommendation: string
}

export type TripAlternativeKind = 'cheaper' | 'faster' | 'luxury' | 'balanced'

export interface TripAlternative {
  kind: TripAlternativeKind
  label: string
  estimatedCost: number | null
  currency: string
  confidence: number
  summary: string
  tripId: string | null
}

export interface TripConfidence {
  overall: number
  provider: number
  price: number
  decision: number
  package: number
  reasoning: string
}

export interface TripWarning {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

export interface Trip {
  id: string
  version: string
  destination: string | null
  origin: string | null
  dates: {
    start: string | null
    end: string | null
    durationDays: number | null
  }
  travelers: TripTravelers
  flights: TripFlight[]
  hotel: TripHotel | null
  activities: TripActivity[]
  transfers: TripTransfer[]
  insurance: TripInsurance | null
  visa: TripVisa | null
  budget: number | null
  currency: string
  confidence: TripConfidence
  recommendation: string
  warnings: TripWarning[]
  alternatives: TripAlternative[]
  timeline: TripTimelineEvent[]
  pricingSummary: TripPricingSummary
  summary: TripSummary
  valid: boolean
  validationErrors: string[]
}

export interface TripComposeRequest {
  conversationId?: string
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  durationDays?: number | null
  adults?: number
  children?: number
  travelerType?: string | null
  budgetCap?: number | null
  currency?: string | null
  /** Raw / provider flight offers (Amadeus or mock). */
  flightOffers?: Array<Record<string, unknown>>
  /** Raw hotel stays. */
  hotelOffers?: Array<Record<string, unknown>>
  /** Optional package builder selected package / ranked list. */
  packageSelected?: {
    id: string
    title: string
    currency: string
    totalPrice: number
    confidence: number
    explanation: string | null
    components: Array<{
      kind: string
      id: string
      title: string
      price: number
      currency: string
      payload: Record<string, unknown>
    }>
    destination?: string | null
    checkIn?: string | null
    checkOut?: string | null
    arrivalAt?: string | null
    departureAt?: string | null
    labels?: string[]
  } | null
  packageRanked?: Array<NonNullable<TripComposeRequest['packageSelected']>>
  /** Decision engine recommendation snippets. */
  decision?: {
    explanation?: string | null
    confidence?: number | null
    bestOverallId?: string | null
    bestBudgetId?: string | null
    fastestId?: string | null
    bestComfortId?: string | null
  } | null
  /** Price intelligence confidence 0–100 or 0–1. */
  priceConfidence?: number | null
  priceTimingNote?: string | null
  /** Include placeholder hotels/activities/transfers/visa/insurance when missing. */
  usePlaceholders?: boolean
}

export interface TripComposeResult {
  version: string
  trip: Trip
  serialized: string
  durationMs: number
}
