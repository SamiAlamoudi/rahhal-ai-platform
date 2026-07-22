/**
 * Sprint 112 — AI Memory & Personalization Engine contracts.
 * Additive persistent personalization layer — does not modify Decision Engine.
 */

export const SPRINT112_MEMORY_ENGINE_VERSION = '1.0.0-memory-engine'

export type TravelStyleKind =
  | 'business'
  | 'family'
  | 'luxury'
  | 'adventure'
  | 'beach'
  | 'shopping'
  | 'leisure'
  | 'unknown'

export type CabinClassKind =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first'

export type SeatTypeKind = 'window' | 'aisle' | 'middle' | 'any'

export type PreferencePolarity = 'prefer' | 'avoid'

export type PreferenceKey =
  | 'preferredAirlines'
  | 'preferredHotelChains'
  | 'preferredCabinClass'
  | 'preferredHotelStars'
  | 'preferredDestinations'
  | 'preferredCountries'
  | 'budgetRange'
  | 'typicalTripDurationDays'
  | 'travelStyles'
  | 'preferredDepartureAirports'
  | 'preferredArrivalAirports'
  | 'preferredLayoverMinutes'
  | 'preferredDepartureTimes'
  | 'preferredSeatType'
  | 'preferredMealOptions'
  | 'preferredHotelAmenities'
  | 'language'
  | 'currency'
  | 'timezone'

/** Preference value with per-item confidence. */
export interface PreferenceValue<T = string> {
  value: T
  confidence: number
  polarity: PreferencePolarity
  observations: number
  updatedAt: string
  source: 'conversation' | 'history' | 'explicit' | 'inferred'
}

export interface BudgetRangePreference {
  min: number | null
  max: number | null
  typical: number | null
  currency: string
  confidence: number
  observations: number
  updatedAt: string
}

export interface LayoverPreference {
  maxMinutes: number | null
  preferDirect: boolean
  confidence: number
  observations: number
  updatedAt: string
}

export interface DepartureTimePreference {
  window: 'morning' | 'afternoon' | 'evening' | 'night' | 'any'
  confidence: number
  observations: number
  updatedAt: string
}

/**
 * Structured traveler profile for the Memory Engine.
 * Distinct from Sprint 76 TravelerProfile (exported as MemoryTravelerProfile).
 */
export interface MemoryTravelerProfile {
  userId: string
  version: 1
  preferredAirlines: PreferenceValue[]
  preferredHotelChains: PreferenceValue[]
  preferredCabinClass: PreferenceValue<CabinClassKind> | null
  preferredHotelStars: PreferenceValue<number> | null
  preferredDestinations: PreferenceValue[]
  preferredCountries: PreferenceValue[]
  budgetRange: BudgetRangePreference | null
  typicalTripDurationDays: PreferenceValue<number> | null
  travelStyles: PreferenceValue<TravelStyleKind>[]
  isBusinessTraveler: boolean
  isFamilyTraveler: boolean
  isLuxuryTraveler: boolean
  isAdventureTraveler: boolean
  isBeachTraveler: boolean
  isShoppingTraveler: boolean
  preferredDepartureAirports: PreferenceValue[]
  preferredArrivalAirports: PreferenceValue[]
  preferredLayover: LayoverPreference | null
  preferredDepartureTimes: DepartureTimePreference[]
  preferredSeatType: PreferenceValue<SeatTypeKind> | null
  preferredMealOptions: PreferenceValue[]
  preferredHotelAmenities: PreferenceValue[]
  language: PreferenceValue | null
  currency: PreferenceValue | null
  timezone: PreferenceValue | null
  createdAt: string
  updatedAt: string
}

export interface ExtractedPreferenceSignal {
  key: PreferenceKey
  value: string | number | boolean
  polarity: PreferencePolarity
  confidence: number
  raw: string
}

export interface ConversationTurnRecord {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  text: string
  at: string
}

export interface SearchMemoryRecord {
  conversationId: string
  origin: string | null
  destination: string | null
  departureDate: string | null
  returnDate: string | null
  budget: number | null
  currency: string | null
  at: string
}

export interface RecommendationMemoryRecord {
  conversationId: string
  optionId: string
  title: string | null
  price: number | null
  currency: string | null
  airline: string | null
  hotelName: string | null
  destination: string | null
  outcome: 'recommended' | 'accepted' | 'rejected'
  at: string
}

export interface ConversationMemoryState {
  userId: string
  conversationIds: string[]
  turns: ConversationTurnRecord[]
  previousDestinations: PreferenceValue[]
  recentSearches: SearchMemoryRecord[]
  previousRecommendations: RecommendationMemoryRecord[]
  acceptedItineraries: RecommendationMemoryRecord[]
  rejectedItineraries: RecommendationMemoryRecord[]
  updatedAt: string
}

export interface TravelHistorySummary {
  userId: string
  mostVisitedCountry: string | null
  favoriteCity: string | null
  averageTripCost: number | null
  averageStayNights: number | null
  favoriteAirline: string | null
  favoriteHotelChain: string | null
  tripCount: number
  currency: string | null
  notes: string[]
}

export interface ExplicitRequestOverrides {
  airline?: string | null
  hotelChain?: string | null
  cabin?: string | null
  budget?: number | null
  destination?: string | null
  maxStops?: number | null
  currency?: string | null
}

export interface MemoryCandidate {
  id: string
  title: string | null
  price: number | null
  currency: string
  airline: string | null
  hotelName: string | null
  hotelStars: number | null
  hotelChain: string | null
  cabin: string | null
  stops: number | null
  durationMinutes: number | null
  destination: string | null
  country: string | null
  departureAirport: string | null
  arrivalAirport: string | null
  layoverMinutes: number | null
  departureHour: number | null
  seatType: string | null
  meal: string | null
  amenities: string[]
  baseScore?: number | null
}

export interface PreferenceResolution {
  effective: {
    airlines: string[]
    hotelChains: string[]
    cabin: CabinClassKind | null
    hotelStarsMin: number | null
    destinations: string[]
    budgetTypical: number | null
    currency: string | null
    preferDirect: boolean
    maxLayoverMinutes: number | null
    travelStyles: TravelStyleKind[]
  }
  matchedPreferences: string[]
  ignoredPreferences: string[]
  overridesApplied: string[]
  reasoningSummary: string
}

export interface PreferenceScoreBreakdown {
  candidateId: string
  total: number
  preferenceMatch: number
  budgetMatch: number
  travelStyle: number
  historySimilarity: number
  destinationAffinity: number
  reasons: string[]
}

export interface MemoryMetadata {
  matchedPreferences: string[]
  ignoredPreferences: string[]
  confidence: number
  memorySource: 'none' | 'profile' | 'conversation' | 'history' | 'merged'
  reasoningSummary: string
  profileUserId: string | null
  extractedCount: number
  scoredCount: number
}

export interface MemoryEngineInput {
  userId: string
  conversationId?: string | null
  /** Latest user utterance(s) for preference extraction. */
  messages?: Array<{ role?: string; text: string }> | null
  /** Explicit requests in the current turn (always win). */
  explicit?: ExplicitRequestOverrides | null
  /** Candidates to score (Decision Engine / Trip Builder / RC options). */
  candidates?: MemoryCandidate[] | null
  /** Optional search context to remember. */
  search?: Omit<SearchMemoryRecord, 'conversationId' | 'at'> | null
  /** Optional recommendation outcomes to remember. */
  recommendationOutcomes?: Array<
    Omit<RecommendationMemoryRecord, 'conversationId' | 'at'>
  > | null
  /** Persist extracted preferences (default true when enabled). */
  persist?: boolean
}

export interface MemoryEngineResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  profile: MemoryTravelerProfile | null
  conversationMemory: ConversationMemoryState | null
  travelHistory: TravelHistorySummary | null
  extracted: ExtractedPreferenceSignal[]
  resolution: PreferenceResolution | null
  scores: PreferenceScoreBreakdown[]
  metadata: MemoryMetadata
  /** Concierge-ready explanation line(s). */
  conciergeHints: string[]
  /** Response Composer-ready notes. */
  responseComposerNotes: string[]
  validationErrors: string[]
  logs: string[]
  latencyMs: number
}

export interface MemoryLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export type MemoryStructuredLogger = (entry: MemoryLogEntry) => void

export function createSilentMemoryLogger(): MemoryStructuredLogger {
  return () => {
    /* logs retained on runner */
  }
}
