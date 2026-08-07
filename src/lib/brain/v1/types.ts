/**
 * Sprint 81/82 — Bilamo AI Brain Foundation + Reasoning Engine contracts.
 * Architecture-only. Not the production turn owner.
 * Gated by `ai.brain.v1` (OFF by default).
 */

export const BRAIN_V1_VERSION = '2.0.0-brain-v2-reasoning'

/** Intent categories required by Sprint 81. */
export type BrainV1Intent =
  | 'flight_search'
  | 'hotel_search'
  | 'package_search'
  | 'multi_city_trip'
  | 'business_travel'
  | 'family_vacation'
  | 'weekend_trip'
  | 'visa_question'
  | 'budget_planning'
  | 'travel_advice'
  | 'booking_modification'
  | 'cancellation'
  | 'price_comparison'
  | 'price_prediction'
  | 'general_conversation'
  | 'unknown'

/** Tools selected via registry (never hardcoded switch-only). */
export type BrainV1ToolId =
  | 'flights'
  | 'hotels'
  | 'packages'
  | 'maps'
  | 'weather'
  | 'visa'
  | 'payments'
  | 'knowledge'
  | 'external_api'
  | 'budget'
  | 'advice'
  | 'none'

export interface BrainV1Entities {
  destination: string | null
  origin: string | null
  travelDates: { start: string | null; end: string | null }
  flexibleDates: boolean | null
  travelerCount: number | null
  adults: number | null
  children: number | null
  infants: number | null
  budget: number | null
  cabinClass: string | null
  preferredAirline: string | null
  hotelRating: number | null
  starLevel: number | null
  mealPreference: string | null
  activities: string[]
  transportation: string | null
  language: string | null
  currency: string | null
  nationality: string | null
  visaDestination: string | null
}

export interface BrainV1IntentResult {
  intent: BrainV1Intent
  confidence: number
  secondary: BrainV1Intent[]
}

export type BrainV1MissingField =
  | 'destination'
  | 'origin'
  | 'travel_dates'
  | 'travelers'
  | 'budget'
  | 'cabin'
  | 'hotel_rating'

export interface BrainV1Clarification {
  field: BrainV1MissingField
  questionAr: string
  questionEn: string
  required: boolean
}

export interface BrainV1ScoreBreakdown {
  price: number
  stops: number
  travelTime: number
  refundability: number
  airlineQuality: number
  hotelQuality: number
  travelerPreferences: number
  historicalChoices: number
  overall: number
}

export interface BrainV1Offer {
  id: string
  kind: 'flight' | 'hotel' | 'package'
  title: string
  price: number | null
  currency: string
  durationMinutes?: number | null
  stops?: number | null
  airline?: string | null
  hotelRating?: number | null
  refundable?: boolean | null
  freeCancellation?: boolean | null
  /** Airline/hotel quality 0–100 optional signal. */
  qualityScore?: number | null
  score?: number
  scoreBreakdown?: BrainV1ScoreBreakdown
  reasons?: string[]
  explanationAr?: string
  explanationEn?: string
}

export type BrainV1PlannerStepId =
  | 'understand_request'
  | 'resolve_conversation_context'
  | 'load_memory'
  | 'detect_missing_entities'
  | 'choose_tools'
  | 'collect_provider_results'
  | 'evaluate_results'
  | 'rank_recommendations'
  | 'generate_natural_answer'
  | 'generate_booking_actions'

export type BrainV1PlannerStepStatus = 'pending' | 'completed' | 'skipped' | 'blocked'

export interface BrainV1PlannerStep {
  id: BrainV1PlannerStepId
  status: BrainV1PlannerStepStatus
  detail: string
}

export type BrainV1NextAction =
  | { kind: 'clarify', field: BrainV1MissingField }
  | { kind: 'invoke_tools', tools: BrainV1ToolId[] }
  | { kind: 'recommend' }
  | { kind: 'advise' }
  | { kind: 'chat' }
  | { kind: 'resume', fromStep: BrainV1PlannerStepId }

export interface BrainV1PlannerState {
  currentGoal: string
  completedSteps: BrainV1PlannerStepId[]
  remainingSteps: BrainV1PlannerStepId[]
  steps: BrainV1PlannerStep[]
  nextAction: BrainV1NextAction
  interrupted: boolean
  resumed: boolean
  continuationSummary: string | null
}

export interface BrainV1SessionMemory {
  sessionId: string
  startedAt: string
  lastIntent: BrainV1Intent | null
  entities: BrainV1Entities
  plannerState: BrainV1PlannerState | null
  interruptedAt: string | null
}

export interface BrainV1ConversationMemory {
  turnCount: number
  recentIntents: BrainV1Intent[]
  pendingClarification: BrainV1MissingField | null
  summary: string | null
}

/** Preference memory layer (in-memory only; no persistence in Sprint 82). */
export interface BrainV1PreferenceMemory {
  cabinClass: string | null
  maxStops: number | null
  preferredAirlines: string[]
  hotelStarMin: number | null
  refundablePreferred: boolean
  currency: string | null
  typicalBudget: number | null
}

export interface BrainV1LongTermMemory {
  preferences: BrainV1TravelPreferences
  profile: BrainV1UserProfile
  previousTrips: BrainV1PreviousTrip[]
  favoriteAirlines: string[]
  favoriteHotels: string[]
  budgetPreferences: { typicalAmount: number | null; currency: string | null }
  /** Historical offer selections for ranking bias (in-memory interface). */
  previousSelections?: string[]
}

export interface BrainV1TravelPreferences {
  cabinClass: string | null
  maxStops: number | null
  preferredAirlines: string[]
  hotelStarMin: number | null
  refundablePreferred: boolean
}

export interface BrainV1UserProfile {
  userId: string | null
  nationality: string | null
  language: string | null
  currency: string | null
}

export interface BrainV1PreviousTrip {
  id: string
  destination: string
  year: number | null
}

/** Sprint 82 multi-step reasoning trace. */
export interface BrainV1ReasoningStep {
  id:
    | 'understand_request'
    | 'resolve_conversation_context'
    | 'load_memory'
    | 'destination_reasoning'
    | 'trip_style_reasoning'
    | 'detect_missing_information'
    | 'choose_tools'
    | 'collect_provider_results'
    | 'evaluate_results'
    | 'rank_offers'
    | 'explain_recommendation'
    | 'generate_natural_answer'
    | 'generate_booking_actions'
    /** Legacy Sprint 81 aliases kept for compatibility. */
    | 'choose_best_provider'
    | 'merge_provider_results'
    | 'generate_conversational_response'
  detail: string
  ok: boolean
}

export interface BrainV1Explanation {
  offerId: string
  ar: string
  en: string
  comparedToId: string | null
  deltas: {
    priceDiff: number | null
    durationMinutesDiff: number | null
    stopsDiff: number | null
  }
}

export interface BrainV1TurnInput {
  text: string
  locale?: 'ar' | 'en'
  sessionId?: string
  history?: Array<{ role: 'user' | 'assistant', text: string }>
  /** Hydrate session from a prior turn (recovery / continuation). */
  priorSession?: BrainV1SessionMemory
  /** Explicit interrupt marker for recovery tests. */
  interrupted?: boolean
  /** Injectable offers for ranking (no live providers). */
  candidateOffers?: BrainV1Offer[]
  /** Optional per-tool injectable results (registry collect step). */
  providerResultsByTool?: Partial<Record<BrainV1ToolId, BrainV1Offer[]>>
  longTerm?: Partial<BrainV1LongTermMemory>
}

export interface BrainV1TurnResult {
  version: string
  enabled: boolean
  intent: BrainV1IntentResult
  entities: BrainV1Entities
  missing: BrainV1MissingField[]
  clarifications: BrainV1Clarification[]
  tools: BrainV1ToolId[]
  reasoning: BrainV1ReasoningStep[]
  planner: BrainV1PlannerState
  rankedOffers: BrainV1Offer[]
  explanation: BrainV1Explanation | null
  collectedOffers: BrainV1Offer[]
  responseAr: string
  responseEn: string
  bookingActions: Array<{ type: string; label: string; payload?: Record<string, unknown> }>
  safe: boolean
  safetyNotes: string[]
  session: BrainV1SessionMemory
  conversation: BrainV1ConversationMemory
  preferenceMemory: BrainV1PreferenceMemory
  promptPreview: string
}

export function emptyBrainV1Entities(): BrainV1Entities {
  return {
    destination: null,
    origin: null,
    travelDates: { start: null, end: null },
    flexibleDates: null,
    travelerCount: null,
    adults: null,
    children: null,
    infants: null,
    budget: null,
    cabinClass: null,
    preferredAirline: null,
    hotelRating: null,
    starLevel: null,
    mealPreference: null,
    activities: [],
    transportation: null,
    language: null,
    currency: null,
    nationality: null,
    visaDestination: null,
  }
}

export function emptyPlannerState(): BrainV1PlannerState {
  return {
    currentGoal: 'idle',
    completedSteps: [],
    remainingSteps: [],
    steps: [],
    nextAction: { kind: 'chat' },
    interrupted: false,
    resumed: false,
    continuationSummary: null,
  }
}
