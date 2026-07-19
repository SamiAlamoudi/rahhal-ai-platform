/**
 * Sprint 31 — Unified Travel Planning Engine types.
 * Additive coordinator over orchestrator, memory, hotels, flights, and search aggregation.
 */

import type { TravelIntent } from '../types'
import type { FlightOption, HotelOption, SearchRecommendation } from '../search/types'
import type { NormalizedHotelResult } from '../../hotels/types'

export type UnifiedTravelPlannerStage =
  | 'collecting'
  | 'clarifying'
  | 'searching'
  | 'optimizing'
  | 'complete'
  | 'failed'

export type UnifiedPlanOptimizationFactor =
  | 'budget'
  | 'duration'
  | 'preferences'
  | 'loyalty'
  | 'conversation_context'
  | 'flight_hotel_match'

export interface UnifiedTripCostEstimate {
  currency: string
  flights: number
  hotels: number
  activities: number
  transport: number
  taxesAndFees: number
  total: number
  nights: number
  withinBudget: boolean | null
  budgetAmount: number | null
  remainingBudget: number | null
}

export interface UnifiedItineraryDay {
  day: number
  date: string | null
  title: string
  summary: string
  items: string[]
}

export interface UnifiedFlightLeg {
  id: string
  from: string
  to: string
  airline: string
  cabin: string
  price: number
  currency: string
  stops: number
  durationHours: number
  providerId: string
}

export interface UnifiedHotelStay {
  id: string
  name: string
  area: string
  stars: number
  nightly: number
  nights: number
  stayTotal: number
  currency: string
  providerId: string
  amenities: string[]
  freeCancellation: boolean
  guestScore: number | null
}

/** One complete ranked travel plan option (flight + hotel matched). */
export interface UnifiedTravelPlanOption {
  id: string
  rank: number
  title: string
  summary: string
  confidence: number
  score: number
  factors: Record<UnifiedPlanOptimizationFactor, number>
  reasons: string[]
  flight: UnifiedFlightLeg | null
  hotel: UnifiedHotelStay | null
  cost: UnifiedTripCostEstimate
  itinerary: UnifiedItineraryDay[]
  matchedPreferences: string[]
  loyaltyAligned: boolean
}

export interface UnifiedFollowUpQuestion {
  field: string
  question: string
  required: boolean
}

export interface UnifiedTravelPlanResult {
  conversationId: string
  stage: UnifiedTravelPlannerStage
  intent: TravelIntent
  headline: string
  /** Ranked itinerary options (best first). */
  plans: UnifiedTravelPlanOption[]
  topPlan: UnifiedTravelPlanOption | null
  alternatives: UnifiedTravelPlanOption[]
  followUps: UnifiedFollowUpQuestion[]
  missingFields: string[]
  recommendation: SearchRecommendation | null
  confidenceScore: number
  reasoning: string[]
  costSummary: UnifiedTripCostEstimate | null
  /** Raw provider snapshots for tests / debug. */
  providers: {
    flightsUsed: number
    hotelsUsed: number
    hotelProviderId: string | null
    flightProviderIds: string[]
    fromHotelFoundation: boolean
    fromOrchestrator: boolean
  }
  durationMs: number
  error: string | null
  /** Opaque orchestrator / memory snapshots (additive). */
  orchestrator: unknown | null
  memory: unknown | null
}

export interface UnifiedTravelPlannerContext {
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  nights: number
  adults: number
  children: number
  currency: string
  budgetAmount: number | null
  preferredAirlines: string[]
  preferredHotels: string[]
  loyaltyPrograms: string[]
  cabinClass: string | null
  activities: string[]
  locale: 'ar' | 'en'
}

export interface UnifiedTravelPlannerOptions {
  /** Override FeatureRegistry for this instance. */
  enabled?: boolean
  /** Use Conversation Memory when available (default: follow flag). */
  contextMemory?: boolean
  /** Use Hotel Provider Foundation for hotel search (default: follow flag / true when planner on). */
  hotelFoundation?: boolean
  /** Max ranked plan options to return. */
  maxPlans?: number
  /** Inject AITripOrchestrator runner (tests). */
  runOrchestrator?: (input: {
    conversationId: string
    userText: string
    locale?: 'ar' | 'en'
    userId?: string
    signal?: AbortSignal
  }) => Promise<unknown>
  /** Inject flight candidates (tests / no live HTTP). */
  searchFlights?: (ctx: UnifiedTravelPlannerContext) => Promise<UnifiedFlightLeg[]>
  /** Inject hotel candidates (tests). */
  searchHotels?: (ctx: UnifiedTravelPlannerContext) => Promise<UnifiedHotelStay[]>
  /** Bypass orchestrator and plan from text + injected providers only. */
  skipOrchestrator?: boolean
}

export interface UnifiedTravelPlannerRunInput {
  conversationId: string
  userText: string
  locale?: 'ar' | 'en'
  userId?: string
  signal?: AbortSignal
  /** Optional pre-seeded context overrides. */
  contextOverrides?: Partial<UnifiedTravelPlannerContext>
}

/** Internal candidate pair before scoring. */
export interface UnifiedPlanCandidate {
  flight: UnifiedFlightLeg | null
  hotel: UnifiedHotelStay | null
  hotelRaw?: NormalizedHotelResult | null
  flightOption?: FlightOption | null
  hotelOption?: HotelOption | null
}
