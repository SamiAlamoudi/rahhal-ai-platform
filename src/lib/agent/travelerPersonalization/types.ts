/**
 * Sprint 76 — Traveler Personalization Intelligence contracts (additive).
 */

export type TripStyleKind =
  | 'business'
  | 'leisure'
  | 'family'
  | 'luxury'
  | 'adventure'

export type CabinPreference =
  | 'economy'
  | 'premium_economy'
  | 'business'
  | 'first'

export type SeatPreference = 'window' | 'aisle' | 'middle' | 'any'

export type SmokingPreference = 'non_smoking' | 'smoking' | 'any'

export type PreferencePolarity = 'prefer' | 'avoid'

/** Single learned preference with gradual confidence (0–1). */
export interface ConfidencePreference<T = string> {
  value: T
  confidence: number
  polarity: PreferencePolarity
  observations: number
  updatedAt: string
}

export interface BudgetHistoryEntry {
  amount: number
  currency: string
  observedAt: string
}

export interface TravelerProfile {
  userId: string
  version: 1
  preferredAirlines: ConfidencePreference[]
  preferredAlliances: ConfidencePreference[]
  preferredCabin: ConfidencePreference<CabinPreference> | null
  preferredSeat: ConfidencePreference<SeatPreference> | null
  mealPreferences: ConfidencePreference[]
  hotelChains: ConfidencePreference[]
  /** Minimum preferred hotel stars (e.g. never below 4). */
  hotelStarPreference: ConfidencePreference<number> | null
  roomType: ConfidencePreference | null
  smokingPreference: ConfidencePreference<SmokingPreference> | null
  budgetHistory: BudgetHistoryEntry[]
  tripStyle: ConfidencePreference<TripStyleKind> | null
  favoriteDestinations: ConfidencePreference[]
  preferredDepartureAirports: ConfidencePreference[]
  /** Placeholder — program names only; no membership numbers. */
  loyaltyPrograms: ConfidencePreference[]
  createdAt: string
  updatedAt: string
}

export interface LearningEvent {
  kind: string
  field: string
  value: string
  polarity: PreferencePolarity
  previousConfidence: number | null
  nextConfidence: number
  conflict: boolean
}

export interface RankingAdjustment {
  candidateId: string
  kind: 'flight' | 'hotel' | 'package'
  delta: number
  reasons: string[]
}

export interface TravelerPersonalizationDiagnostics {
  travelerProfileUsed: boolean
  matchedPreferences: string[]
  confidenceScores: Record<string, number>
  rankingAdjustments: RankingAdjustment[]
  learningEvents: LearningEvent[]
  missingProfile: boolean
}

export interface PersonalizedCandidate {
  id: string
  kind: 'flight' | 'hotel' | 'package'
  title: string
  baseScore: number
  personalizedScore: number
  delta: number
  reasons: string[]
  payload: Record<string, unknown>
}

export interface TravelerPersonalizationResult {
  version: string
  profile: TravelerProfile | null
  diagnostics: TravelerPersonalizationDiagnostics
  rankedFlights: PersonalizedCandidate[]
  rankedHotels: PersonalizedCandidate[]
  recommendationFacts: string[]
  durationMs: number
}

export const SPRINT76_TRAVELER_PERSONALIZATION_VERSION = '1.0.0-personalization'
