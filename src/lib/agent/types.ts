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
  | 'discover'
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
  | 'show_my_itinerary'
  | 'whats_todays_plan'
  | 'when_leave_for_airport'
  | 'summarize_my_trip'
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
  /**
   * Sprint 45 — traveler asked for open-ended discovery ("somewhere cold…")
   * rather than naming a place. Destination is not a hard intake slot while true.
   */
  destinationFlexible: boolean | null
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
  /**
   * Sprint 45 — autonomous travel reasoning snapshot (open-ended destination discovery).
   * Additive; never replaces TripPlan. Present when `ai.travel_reasoning` produced a turn.
   */
  reasoning?: {
    mode: string
    overallConfidence: number
    primaryId: string | null
    candidateIds: string[]
    summary: string
    rationale: string[]
    followUpFields: string[]
    inferredMonth: number | null
    inferredClimate: string | null
  }
  /**
   * Sprint 46 — soft preference inference snapshot (never-ask-twice).
   */
  clarification?: {
    inferredFields: string[]
    rationale: string[]
  }
  /**
   * Sprint 51 — Executive Travel Platform snapshot.
   */
  executivePlatform?: {
    engineIds: string[]
    confidence: number
    alertCount: number
    recommendationCount: number
    hasPrimaryReply: boolean
  }
  /**
   * Sprint 53 — Real World Intelligence Layer snapshot.
   */
  liveIntelligence?: {
    domains: string[]
    providerIds: string[]
    confidence: number
    degraded: boolean
    latencyMs: number
    cacheHits: number
    cacheMisses: number
    hasSummary: boolean
    flightCount: number
    hotelCount: number
  }
  /**
   * Sprint 52 — Executive Operating System snapshot.
   */
  executiveOs?: {
    strategy: string | null
    goal: string | null
    engineIds: string[]
    topOptionCount: number
    improvedOnce: boolean
    acceptProbability: number | null
  }
  /**
   * Phase 2 — Travel Executive orchestration snapshot.
   */
  travelExecutive?: {
    travelStyle: string
    optimizationAxis: string | null
    rejectedCount: number
    learnedRejections: string[]
    budgetWarnings: string[]
  }
  /**
   * Sprint 50 — Rahhal Brain Core orchestration snapshot (production path).
   * Present when `ai.rahhal_brain` runs the turn decision pipeline.
   */
  rahhalBrain?: {
    decision: string
    primaryIntent: string
    intentConfidence: number
    secondaryIntents: string[]
    discoveryMode: boolean
    modulesExecuted: string[]
    reflected: boolean
    internalPlanSteps: number
  }
  /**
   * Sprint 20 — structured BrainResponsePlan snapshot (additive, optional).
   * Present when `brain.concierge` integration is enabled; never replaces reply text
   * unless Sprint 21 `brain.travel_engine` supplies contextualReply.
   */
  brain?: {
    intent: string
    confidence: number
    action: string
    summary: string
    assistantGoal: string
    missingFields: string[]
    searchRequests: unknown[]
    bookingRequests: unknown[]
    recommendations: unknown[]
    uiHints: unknown
    /** Sprint 21 — structured TravelPlan + domain bridge */
    travelPlan?: unknown
    domain?: unknown
    contextualReply?: string | null
    /** Sprint 22 — TripPlanningEngine outputs */
    planning?: unknown
    clarificationQuestion?: string | null
    travelSummary?: unknown
    engineTripPlan?: unknown
    /** Sprint 23 — TravelExecutionEngine outputs */
    execution?: unknown
    executionSummary?: unknown
    executionProgress?: unknown
    /** Sprint 24 — SearchAggregationEngine outputs */
    search?: unknown
    searchRecommendation?: unknown
    searchCollection?: unknown
    /** Sprint 27 — AITripOrchestrator outputs */
    orchestrator?: unknown
    /** Sprint 28 — Conversation Memory & Context Engine */
    memory?: unknown
    memoryFollowUps?: string[] | null
    memorySummary?: string | null
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
    destinationFlexible: null,
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
