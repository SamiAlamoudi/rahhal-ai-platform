/**
 * Sprint 55 — Real Booking Intelligence contracts.
 * Structured booking enrichment only — Conversation Brain authors traveler-facing text.
 */

export type BookingProviderDomain =
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'car_rental'
  | 'airport_transfer'
  | 'insurance'
  | 'visa'

export type BookingOfferKind = BookingProviderDomain

export interface MoneyAmount {
  amount: number
  currency: string
  /** Amount converted to the traveler's preferred currency when available. */
  normalizedAmount?: number
  normalizedCurrency?: string
}

export interface BookingSearchQuery {
  domain: BookingProviderDomain
  origin?: string | null
  destination?: string | null
  startDate?: string | null
  endDate?: string | null
  travelers?: number
  adults?: number
  children?: number
  /** Cabin class hint for flight search (economy / business / first / …). */
  cabin?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  locale?: 'ar' | 'en'
  preferences?: BookingTravelerPreferences
  signal?: AbortSignal
}

export interface BookingOffer {
  id: string
  domain: BookingOfferKind
  providerId: string
  title: string
  subtitle?: string
  price: MoneyAmount
  rating?: number | null
  qualityScore?: number
  locationScore?: number
  durationMinutes?: number | null
  layoverCount?: number | null
  layoverQuality?: number | null
  refundable?: boolean | null
  refundPolicy?: 'flexible' | 'moderate' | 'strict' | 'unknown'
  walkingDistanceMeters?: number | null
  stars?: number | null
  airline?: string | null
  hotelChain?: string | null
  seatType?: string | null
  mealIncluded?: boolean | null
  raw?: unknown
}

export interface BookingProvider {
  readonly providerId: string
  readonly domain: BookingProviderDomain
  readonly displayName: string
  isAvailable(): boolean
  search(query: BookingSearchQuery): Promise<BookingOffer[]>
  details(offerId: string, signal?: AbortSignal): Promise<BookingOffer | null>
  availability(offerId: string, signal?: AbortSignal): Promise<{ available: boolean; seatsOrRooms?: number }>
  price(offerId: string, signal?: AbortSignal): Promise<MoneyAmount | null>
  /** Stub — real booking adapters plug in later without orchestration changes. */
  book(offerId: string, signal?: AbortSignal): Promise<{ ok: boolean; confirmationId?: string; error?: string }>
  /** Stub — real cancel adapters plug in later without orchestration changes. */
  cancel(confirmationId: string, signal?: AbortSignal): Promise<{ ok: boolean; error?: string }>
}

export interface BookingProviderRegistry {
  list(): BookingProvider[]
  listDomains(): BookingProviderDomain[]
  get(providerId: string): BookingProvider | undefined
  forDomain(domain: BookingProviderDomain): BookingProvider[]
  register(provider: BookingProvider): void
  route(domain: BookingProviderDomain): BookingProvider[]
}

export type BudgetStylePreference = 'budget' | 'midrange' | 'luxury' | null
export type TripPersona = 'family' | 'business' | 'luxury' | 'couple' | 'solo' | 'friends' | null

export interface BookingTravelerPreferences {
  userId: string
  preferredAirlines: string[]
  preferredHotelChains: string[]
  seatType: 'window' | 'aisle' | 'any' | null
  hotelStarsMin: number | null
  maxWalkingDistanceMeters: number | null
  preferredAirports: string[]
  mealPreference: string | null
  budgetStyle: BudgetStylePreference
  persona: TripPersona
  pastSelectedOfferIds: string[]
  pastSelectedProviderIds: string[]
  updatedAt: string
}

export interface FusedOffer extends BookingOffer {
  confidence: number
  qualityScore: number
  fusedFromProviderIds: string[]
}

export interface RankedOffer extends FusedOffer {
  rankScore: number
  rankFactors: {
    price: number
    quality: number
    location: number
    rating: number
    duration: number
    layover: number
    refund: number
    preference: number
    pastSelection: number
  }
}

export interface CostCombination {
  id: string
  strategy: 'split' | 'package' | 'mixed'
  flightId: string | null
  hotelId: string | null
  activityIds: string[]
  transferId: string | null
  carRentalId: string | null
  insuranceId: string | null
  total: MoneyAmount
  valueScore: number
  label: string
}

export interface BookingReadinessResult {
  bookingReady: boolean
  missingFields: string[]
  clarification: string | null
  priorityField: string | null
}

export interface RecommendationConfidence {
  confidence: number
  reasons: string[]
  missingInformation: string[]
  alternatives: Array<{ id: string; title: string; why: string }>
}

export interface RecommendationExplanation {
  offerId: string
  /** User-facing explanation only — never internal scores. */
  explanation: string
  locale: 'ar' | 'en'
}

export interface BookingIntelligenceSnapshot {
  version: 1
  bookingReady: boolean
  clarification: string | null
  primaryOfferId: string | null
  rankedCount: number
  domainsSearched: BookingProviderDomain[]
  providerIds: string[]
  topConfidence: number
  topExplanation: string | null
  bestCombinationId: string | null
  bestCombinationTotal: MoneyAmount | null
  preferenceUserId: string | null
  durationMs: number
}

export interface BookingIntelligenceResult {
  snapshot: BookingIntelligenceSnapshot
  ranked: RankedOffer[]
  fused: FusedOffer[]
  combinations: CostCombination[]
  readiness: BookingReadinessResult
  confidence: RecommendationConfidence
  explanations: RecommendationExplanation[]
  /** Short facts for Conversation Brain — not full prose templates. */
  recommendationFacts: string[]
}
