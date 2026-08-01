/**
 * Sprint 81 — Rahhal AI Brain Foundation (Phase 1) contracts.
 * Architecture-only. Not the production turn owner.
 */

export const BRAIN_V1_VERSION = '1.0.0-brain-v1-foundation'

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

export type BrainV1ToolId =
  | 'flights'
  | 'hotels'
  | 'packages'
  | 'visa'
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
  score?: number
  reasons?: string[]
}

export interface BrainV1SessionMemory {
  sessionId: string
  startedAt: string
  lastIntent: BrainV1Intent | null
  entities: BrainV1Entities
}

export interface BrainV1ConversationMemory {
  turnCount: number
  recentIntents: BrainV1Intent[]
  pendingClarification: BrainV1MissingField | null
  summary: string | null
}

export interface BrainV1LongTermMemory {
  preferences: BrainV1TravelPreferences
  profile: BrainV1UserProfile
  previousTrips: BrainV1PreviousTrip[]
  favoriteAirlines: string[]
  favoriteHotels: string[]
  budgetPreferences: { typicalAmount: number | null; currency: string | null }
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

export interface BrainV1ReasoningStep {
  id:
    | 'understand_request'
    | 'detect_missing_information'
    | 'choose_best_provider'
    | 'merge_provider_results'
    | 'rank_offers'
    | 'explain_recommendation'
    | 'generate_conversational_response'
  detail: string
  ok: boolean
}

export interface BrainV1TurnInput {
  text: string
  locale?: 'ar' | 'en'
  sessionId?: string
  history?: Array<{ role: 'user' | 'assistant', text: string }>
  /** Injectable offers for ranking tests (no live providers in Phase 1). */
  candidateOffers?: BrainV1Offer[]
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
  rankedOffers: BrainV1Offer[]
  responseAr: string
  responseEn: string
  bookingActions: Array<{ type: string; label: string; payload?: Record<string, unknown> }>
  safe: boolean
  safetyNotes: string[]
  session: BrainV1SessionMemory
  conversation: BrainV1ConversationMemory
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
