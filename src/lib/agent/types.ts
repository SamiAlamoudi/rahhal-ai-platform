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
  /**
   * Experience Sprint 1 — short conversational text for TTS.
   * Never the full itinerary markdown; screen content stays in the message body.
   */
  spokenText?: string
  /** Voice phase: bridge speaks immediately; final replaces after the turn completes. */
  voicePhase?: 'bridge' | 'final'
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
   * Sprint 54 — Autonomous Travel Agent snapshot (goal, plan, progress, observability).
   * Additive; never replaces Conversation Brain display/spoken text.
   */
  autonomous?: {
    state: string
    progressPhase: string
    goal: {
      id: string
      objective: string
      description: string
      status: string
      blockingFields: string[]
    } | null
    planTaskCount: number
    completedTaskIds: string[]
    pendingTaskIds: string[]
    lastProviderId: string | null
    totalRetries: number
    durationMs: number
    outcome: string
    recoveredFromFailures: boolean
  }
  /** Latest streamed progress phase for UI badges (Thinking/Searching/…). */
  autonomousProgress?: {
    phase: string
    state: string
    message: string
    activeTaskKind?: string
    providerId?: string
    retryCount?: number
  }
  /**
   * Sprint 55 — Real Booking Intelligence snapshot (fusion, ranking, readiness, confidence).
   * Additive; explanations are facts for Conversation Brain — never replace reply authorship.
   */
  bookingIntelligence?: {
    bookingReady: boolean
    clarification: string | null
    primaryOfferId: string | null
    rankedCount: number
    domainsSearched: string[]
    providerIds: string[]
    topConfidence: number
    topExplanation: string | null
    bestCombinationId: string | null
    bestCombinationTotal: { amount: number; currency: string } | null
    preferenceUserId: string | null
    durationMs: number
  }
  /**
   * Sprint 75 — Budget Intelligence snapshot (allocation, Budget Score, diagnostics).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  budgetIntelligence?: {
    budgetDetected: boolean
    currency: string | null
    amount: number | null
    remainingBudget: number | null
    budgetScore: number | null
    intent: string
    overflow: boolean
    underflow: boolean
    missingBudget: boolean
    allocatedFlights: number | null
    allocatedHotels: number | null
    durationMs: number
  }
  /**
   * Sprint 76 — Traveler Personalization snapshot (profile, confidence, ranking deltas).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  travelerPersonalization?: {
    travelerProfileUsed: boolean
    matchedPreferences: string[]
    confidenceScores: Record<string, number>
    rankingAdjustmentCount: number
    learningEventCount: number
    missingProfile: boolean
    durationMs: number
  }
  /**
   * Sprint 77 — Complete Trip Optimizer snapshot (Journey Score, recommendations, tradeoffs).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  tripOptimizer?: {
    journeyScore: number | null
    priority: string
    itineraryCount: number
    budgetEffect: number
    personalizationEffect: number
    tradeoffCount: number
    bestOverallId: string | null
    recommendationLabels: string[]
    durationMs: number
  }
  /**
   * Sprint 78 — AI Travel Strategy Planner snapshot (purpose, constraints, search plan).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  travelPlanner?: {
    travelPurpose: string
    tripType: string
    travelerType: string
    travelStrategy: string
    confidenceScore: number
    searchImmediately: boolean
    shouldAskQuestion: boolean
    recommendedSearchOrder: string[]
    missingInformation: string[]
    combinedQuestion: string | null
    riskFlags: string[]
    durationMs: number
  }
  /**
   * Sprint 79 — Autonomous Search & Decision Engine snapshot.
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  autonomousDecision?: {
    bestOverallId: string | null
    bestOverallScore: number | null
    confidence: number
    planCount: number
    candidateCount: number
    duplicateCount: number
    fallbackUsed: boolean
    labels: string[]
    explanation: string | null
    durationMs: number
  }
  /**
   * Sprint 80 — Adaptive Learning snapshot (local preference adaptation).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  adaptiveLearning?: {
    learningEnabled: boolean
    preferenceCount: number
    preferencesUpdated: number
    inferredCount: number
    eventsProcessed: number
    topPreferences: Array<{ kind: string; value: string; confidence: number }>
    durationMs: number
  }
  /**
   * Sprint 81 — Price Intelligence & Booking Timing snapshot.
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  priceIntelligence?: {
    action: string
    confidence: number
    explanation: string | null
    opportunities: string[]
    signalsUsed: string[]
    currentPrice: number | null
    averagePrice: number | null
    trend: string | null
    daysToDeparture: number | null
    durationMs: number
  }
  /**
   * Sprint 83 — AI Dynamic Travel Packages snapshot.
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  dynamicPackages?: {
    selectedId: string | null
    selectedTitle: string | null
    selectedScore: number | null
    confidence: number
    packageCount: number
    duplicateCount: number
    filteredCount: number
    labels: string[]
    explanation: string | null
    durationMs: number
  }
  /**
   * Sprint 84 — Itinerary Refinement snapshot (incremental package updates).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  itineraryRefinement?: {
    changesApplied: string[]
    impactedCount: number
    reusedCount: number
    conflictCount: number
    alternativeCount: number
    confidence: number
    incremental: boolean
    summary: string | null
    durationMs: number
  }
  /**
   * Sprint 89 — Rahhal AI Constitution validation snapshot (live pipeline).
   */
  constitution?: {
    enabled: boolean
    ok: boolean
    violationCount: number
    violationCodes: string[]
    checkedPrinciples: string[]
    recoveryAttemptCount: number
    hasRecommendation: boolean
    confidence: number
    durationMs: number
  }
  /**
   * Sprint 91 — Production Alpha Experience orchestration snapshot.
   * Additive presentation facts — Conversation Brain / UI may consume timeline + recommendation.
   */
  alphaExperience?: {
    version: string
    conversationId: string
    progressPercent: number
    stageCount: number
    alternativeCount: number
    overallConfidence: number
    recovered: boolean
    constitutionOk: boolean
    estimatedCost: number | null
    currency: string
    durationMs: number
  }
  /**
   * Sprint 94 — Live Booking Orchestrator session snapshot.
   */
  bookingOrchestrator?: {
    version: string
    sessionId: string
    state: string
    reservationCount: number
    paymentRequired: boolean
    durationMs: number
  }
  /**
   * Sprint 57 — Booking Execution Engine snapshot (lifecycle, confirmations, resume).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  bookingExecution?: {
    sessionId: string
    status: string
    bookingIds: string[]
    confirmedCount: number
    failedCount: number
    cancelledCount: number
    expiredCount: number
    domains: string[]
    providerIds: string[]
    durationMs: number
    resumed: boolean
    rolledBack: boolean
    idempotentReplay: boolean
  }
  /**
   * Sprint 58 — Payments & Ticketing snapshot (capture, tickets, documents).
   * Additive structured facts only — Conversation Brain authors traveler-facing text.
   */
  payments?: {
    paymentSessionId: string
    status: string
    method: string
    providerId: string | null
    amount: number
    currency: string
    ticketCount: number
    documentCount: number
    refundCount: number
    riskScore: number
    durationMs: number
    resumed: boolean
    idempotentReplay: boolean
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
