/**
 * Sprint 19 — AI Travel Brain types.
 * Pure orchestration: no LLM providers, no external APIs, no fabricated dialogue.
 */

export type BrainLocale = 'ar' | 'en'

export type TravelIntent =
  | 'SearchFlights'
  | 'SearchHotels'
  | 'SearchPackages'
  | 'ModifyTrip'
  | 'CancelBooking'
  | 'ContinueBooking'
  | 'AskRecommendation'
  | 'TravelAdvice'
  | 'VisaQuestion'
  | 'WeatherQuestion'
  | 'BudgetPlanning'
  | 'PackingAdvice'
  | 'GeneralConversation'

export type BrainMemorySlot =
  | 'destination'
  | 'origin'
  | 'budget'
  | 'travelDates'
  | 'travelers'
  | 'cabinClass'
  | 'airlinePreferences'
  | 'hotelPreferences'
  | 'hotelRequirement'
  | 'activities'
  | 'visaRequirements'
  | 'conversationLanguage'
  | 'currency'

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first'

export interface TravelDates {
  startDate: string | null
  endDate: string | null
  durationDays: number | null
  flexible: boolean
}

export interface BudgetSlot {
  amount: number | null
  currency: string | null
  flexible: boolean
}

export interface TravelerSlot {
  count: number | null
  adults: number | null
  children: number | null
  infants: number | null
}

/** Persistent conversation memory — slot-filled travel facts. */
export interface ConversationMemory {
  conversationId: string
  destination: string | null
  destinations: string[]
  /** Departure city / origin for flight search. */
  origin: string | null
  budget: BudgetSlot
  travelDates: TravelDates
  travelers: TravelerSlot
  cabinClass: CabinClass | null
  airlinePreferences: string[]
  hotelPreferences: string[]
  /** Whether the trip needs a hotel (true/false); null = unknown. */
  hotelRequirement: boolean | null
  activities: string[]
  visaRequirements: string | null
  conversationLanguage: BrainLocale
  currency: string | null
  /** Fields already asked — never ask twice. */
  askedFields: BrainMemorySlot[]
  /** Fields the user has answered (explicitly or inferred). */
  answeredFields: BrainMemorySlot[]
  updatedAt: string
}

export interface TravelGoals {
  primaryIntent: TravelIntent | null
  secondaryIntents: TravelIntent[]
  tripPurpose: string | null
  mustHave: string[]
  niceToHave: string[]
}

export interface TripPreferences {
  pace: 'relaxed' | 'balanced' | 'packed' | null
  style: 'luxury' | 'midrange' | 'budget' | null
  interests: string[]
  avoid: string[]
  notes: string | null
}

export interface ConversationHistoryTurn {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent: TravelIntent | null
  createdAt: string
}

export interface ConversationHistory {
  conversationId: string
  turns: ConversationHistoryTurn[]
}

export interface ConversationContext {
  conversationId: string
  memory: ConversationMemory
  history: ConversationHistory
  goals: TravelGoals
  preferences: TripPreferences
  lastIntent: TravelIntent | null
  missingFields: BrainMemorySlot[]
  locale: BrainLocale
}

export type BrainAction =
  | 'ask_missing'
  | 'search_flights'
  | 'search_hotels'
  | 'search_packages'
  | 'recommend'
  | 'advise'
  | 'visa_info'
  | 'weather_info'
  | 'budget_plan'
  | 'packing_advice'
  | 'modify_trip'
  | 'cancel_booking'
  | 'continue_booking'
  | 'acknowledge'
  | 'none'

export interface SearchRequestHint {
  kind: 'flights' | 'hotels' | 'packages'
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  travelers: number | null
  adults: number | null
  children: number | null
  infants: number | null
  cabinClass: CabinClass | null
  budgetAmount: number | null
  currency: string | null
  preferredAirlines: string[]
  preferredHotels: string[]
  hotelRequired: boolean | null
  flexibleDates: boolean
}

export interface BookingRequestHint {
  kind: 'continue' | 'modify' | 'cancel'
  reason: string | null
}

export interface RecommendationHint {
  topic: string
  reason: string
}

export interface UiHints {
  showMemoryPanel: boolean
  showIntentChip: boolean
  highlightMissing: BrainMemorySlot[]
  suggestedReplies: string[]
  /** Sprint 21 — single short contextual follow-up (when travel engine is on). */
  contextualReply: string | null
}

/**
 * Structured response plan — no LLM text generation.
 * Consumers (future LLM / UI) use these fields as contracts.
 */
export interface BrainResponsePlan {
  summary: string
  assistantGoal: string
  missingFields: BrainMemorySlot[]
  action: BrainAction
  uiHints: UiHints
  searchRequests: SearchRequestHint[]
  bookingRequests: BookingRequestHint[]
  recommendations: RecommendationHint[]
  intent: TravelIntent
  confidence: number
  /** Sprint 21 — structured travel plan when domain engine is active. */
  travelPlan: TravelPlan | null
}

/**
 * Sprint 21 — structured TravelPlan linking Brain memory to real domain surfaces.
 * No external provider calls; drafts only.
 */
export interface TravelPlan {
  id: string
  conversationId: string
  locale: BrainLocale
  status: 'collecting' | 'ready'
  summary: string
  destination: string | null
  origin: string | null
  dates: TravelDates
  travelers: TravelerSlot
  cabinClass: CabinClass | null
  budget: BudgetSlot
  preferredAirlines: string[]
  preferredHotels: string[]
  hotelRequired: boolean | null
  activities: string[]
  flights: TravelPlanDomainLink | null
  hotels: TravelPlanDomainLink | null
  itinerary: TravelPlanDomainLink | null
  bookingSession: TravelPlanDomainLink | null
  passengers: TravelPlanPassengerLink | null
}

export interface TravelPlanDomainLink {
  kind: 'flights' | 'hotels' | 'itinerary' | 'booking_session'
  ready: boolean
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  notes: string[]
}

export interface TravelPlanPassengerLink {
  kind: 'passengers'
  ready: boolean
  adults: number
  children: number
  infants: number
  total: number
  slotCount: number
}

export interface IntentClassification {
  intent: TravelIntent
  confidence: number
  signals: string[]
}

export interface ExtractedRequirements {
  patch: Partial<ConversationMemory>
  entities: Record<string, unknown>
}

export interface BrainTurnInput {
  conversationId?: string
  userText: string
  locale?: BrainLocale
}

export interface BrainTurnResult {
  context: ConversationContext
  classification: IntentClassification
  extraction: ExtractedRequirements
  missingFields: BrainMemorySlot[]
  plan: BrainResponsePlan
  /** Sprint 21 — domain bridge payload when travel engine is on. */
  domain: TravelDomainBridge | null
  /**
   * Sprint 22 — multi-step trip planning result when trip planning is on.
   * Typed as unknown here to avoid circular imports with tripPlanning/;
   * consumers use TripPlanningTurnResult via integration / tripPlanning exports.
   */
  planning: unknown | null
  /**
   * Sprint 23 — travel execution result when brain.execution is on.
   * Typed as unknown to avoid circular imports; use TravelExecutionTurnResult from execution/.
   */
  execution: unknown | null
  /**
   * Sprint 24 — search aggregation result when brain.search is on.
   * Typed as unknown to avoid circular imports; use SearchAggregationTurnResult from search/.
   */
  search: unknown | null
}

/** Sprint 21 — BrainResponsePlan → real travel domain drafts (no live API calls). */
export interface TravelDomainBridge {
  searchDraft: TravelSearchDraft | null
  passengerCounts: {
    adults: number
    children: number
    infants: number
    total: number
  } | null
  passengerSlotIds: string[]
  bookingSessionDraft: {
    status: 'draft'
    currency: string | null
    itemKinds: Array<'flight' | 'hotel' | 'package'>
  } | null
  itinerarySeed: {
    destination: string | null
    durationDays: number | null
    travelers: number | null
  } | null
}

export interface TravelSearchDraft {
  destination: string
  departureCity: string
  departureDate: string
  returnDate: string
  durationDays: number
  adults: number
  children: number
  infants: number
  preferredCabin: string
  preferredAirlines: string[]
  preferredHotels: string[]
  budgetAmount: number
  budgetCurrency: string
  hotelRequired: boolean | null
  flexibleDates: boolean
  readyForSearch: boolean
  missingFields: BrainMemorySlot[]
}
