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
  | 'budget'
  | 'travelDates'
  | 'travelers'
  | 'cabinClass'
  | 'airlinePreferences'
  | 'hotelPreferences'
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
  budget: BudgetSlot
  travelDates: TravelDates
  travelers: TravelerSlot
  cabinClass: CabinClass | null
  airlinePreferences: string[]
  hotelPreferences: string[]
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
  cabinClass: CabinClass | null
  budgetAmount: number | null
  currency: string | null
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
}
