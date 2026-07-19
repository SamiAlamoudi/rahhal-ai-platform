/**
 * Travel AI Agent foundation models — structured planning over the shared chatEngine.
 */

import type { TripDecision } from './decision/types'

export type { TripDecision }
export type AgentLocale = 'ar' | 'en'

export type TravelerType = 'solo' | 'couple' | 'family' | 'friends' | 'business'

export type BudgetStyle = 'luxury' | 'midrange' | 'budget'

export type PackageScope = 'flights_only' | 'full_package'

export type AgentPhase = 'collecting' | 'planned' | 'editing'

export type AgentIntent =
  | 'plan'
  | 'answer'
  | 'regenerate'
  | 'regenerate_day'
  | 'edit'
  | 'save'
  | 'show_trips'
  | 'show_latest_booking'
  | 'show_booking_details'
  | 'summarize_itinerary'
  | 'booking_confirmed'
  | 'show_confirmation'
  | 'booking_reference'
  | 'booking_status'
  | 'how_much_will_i_pay'
  | 'is_order_ready'
  | 'show_checkout'
  | 'what_is_payment_status'
  | 'unknown'

/** Scoped regeneration target for the Intelligent Decision Engine. */
export type RegenerateScope =
  | 'whole'
  | 'day'
  | 'flight'
  | 'hotel'
  | 'activities'

export interface TripRequirements {
  destination: string | null
  destinations: string[]
  origin: string | null
  startDate: string | null
  endDate: string | null
  durationDays: number | null
  travelers: number | null
  travelerType: TravelerType | null
  budgetAmount: number | null
  budgetCurrency: string | null
  /** True when the user said budget is flexible / no ceiling. */
  budgetFlexible: boolean | null
  budgetStyle: BudgetStyle | null
  hotelPreference: string | null
  packageScope: PackageScope | null
  weatherPreference: string | null
  interests: string[]
  notes: string | null
  tripPurpose: 'leisure' | 'honeymoon' | 'business' | 'family' | null
  /** When intent is regenerate_day — 1-based day index. */
  regenerateDay: number | null
  /** Scoped regenerate: whole trip, day, flight, hotel, or activities. */
  regenerateScope: RegenerateScope | null
}

export interface ItineraryActivity {
  time: string | null
  title: string
  description: string | null
}

/** Optional per-day weather shown beside the itinerary (from the weather tool). */
export interface DayWeatherSnapshot {
  summary: string
  condition: string
  tempHighC: number | null
  tempLowC: number | null
  rainProbability: number | null
  advice: string | null
}

export interface ItineraryDay {
  day: number
  title: string
  location: string
  activities: ItineraryActivity[]
  /** Weather enrichment for this day when forecasts are available. */
  weather?: DayWeatherSnapshot | null
}

export interface TransportationItem {
  mode: string
  from: string
  to: string
  notes: string | null
  estimatedCost: number | null
  currency: string | null
}

export interface AccommodationRecommendation {
  name: string
  area: string
  category: 'hotel' | 'resort' | 'apartment' | 'boutique'
  fit: string
  estimatedNightly: number | null
  currency: string
}

export interface AttractionItem {
  title: string
  tag: string | null
  dayHint: number | null
}

export interface FlightRecommendation {
  from: string
  to: string
  airline: string | null
  stops: number | null
  estimatedCost: number | null
  currency: string | null
  notes: string | null
}

export interface BudgetBreakdownLine {
  label: string
  amount: number
}

export interface EstimatedBudget {
  amount: number
  currency: string
  breakdown: BudgetBreakdownLine[]
}

/**
 * Canonical structured trip plan produced by the Travel AI Agent.
 * `TravelItinerary` remains as a compatibility alias.
 */
export interface TripPlan {
  id: string
  title: string
  summary: string
  locale: AgentLocale
  destinations: string[]
  startDate: string | null
  endDate: string | null
  durationDays: number
  travelers: number | null
  travelerType: TravelerType | null
  interests: string[]
  dailyItinerary: ItineraryDay[]
  /** Compatibility mirror of dailyItinerary for MVP callers. */
  activities: ItineraryDay[]
  transportation: TransportationItem[]
  flights: FlightRecommendation[]
  accommodations: AccommodationRecommendation[]
  attractions: AttractionItem[]
  weatherNotes: string[]
  visaNotes: string[]
  travelTips: string[]
  packingSuggestions: string[]
  estimatedBudget: EstimatedBudget
  /** Alias used in product copy / saved-trip payloads. */
  estimatedCosts: EstimatedBudget
  notes: string[]
  conversationId: string
  requirements: TripRequirements
  updatedAt: string
  /**
   * Optional Intelligent Decision Engine enrichment.
   * Core TripPlan fields remain the canonical plan; this explains rankings.
   */
  decision?: TripDecision | null
}

/** @deprecated Prefer TripPlan — kept for MVP compatibility. */
export type TravelItinerary = TripPlan

export interface AgentMemory {
  locale: AgentLocale
  phase: AgentPhase
  requirements: TripRequirements
  tripPlan: TripPlan | null
  /** MVP compatibility mirror of tripPlan. */
  itinerary: TripPlan | null
  missingFields: Array<keyof TripRequirements>
  lastIntent: AgentIntent
}

export interface AgentToolRunSummary {
  tool: string
  status: string
  summary: string
  providerId?: string
  durationMs?: number
}

export interface AgentProviderMeta {
  kind: 'travel_agent'
  version: 2
  memory: AgentMemory
  tripPlan: TripPlan | null
  /** MVP compatibility mirror of tripPlan. */
  itinerary: TripPlan | null
  /** Phase J: tool batch executed for this assistant turn */
  toolResults?: AgentToolRunSummary[]
  /**
   * Sprint 9 — Concierge dialogue state (additive, optional).
   * Opaque to the provider layer; Concierge remains supplier-agnostic.
   */
  concierge?: {
    phase: string
    softSignals: Record<string, unknown>
    lastAction: string | null
    heardSummary: string[]
    turnCount: number
  }
}

/** Ordered intake slots for interactive trip planning (Phase L). */
export const INTAKE_FIELD_ORDER: Array<keyof TripRequirements> = [
  'destination',
  'durationDays',
  'budgetAmount',
  'travelers',
  'travelerType',
  'interests',
  'weatherPreference',
  'budgetStyle',
  'hotelPreference',
  'packageScope',
]

export function emptyRequirements(): TripRequirements {
  return {
    destination: null,
    destinations: [],
    origin: null,
    startDate: null,
    endDate: null,
    durationDays: null,
    travelers: null,
    travelerType: null,
    budgetAmount: null,
    budgetCurrency: null,
    budgetFlexible: null,
    budgetStyle: null,
    hotelPreference: null,
    packageScope: null,
    weatherPreference: null,
    interests: [],
    notes: null,
    tripPurpose: null,
    regenerateDay: null,
    regenerateScope: null,
  }
}

export function emptyMemory(locale: AgentLocale = 'ar'): AgentMemory {
  return {
    locale,
    phase: 'collecting',
    requirements: emptyRequirements(),
    tripPlan: null,
    itinerary: null,
    missingFields: ['destination', 'durationDays'],
    lastIntent: 'unknown',
  }
}

export function withTripPlan(memory: AgentMemory, plan: TripPlan | null): AgentMemory {
  return {
    ...memory,
    tripPlan: plan,
    itinerary: plan,
  }
}
