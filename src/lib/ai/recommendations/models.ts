/**
 * Phase AC — Recommendation Engine v1 models.
 * Additive; keeps Phase AB RecommendationCandidate contracts available.
 */

export type RecommendationKind =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'itinerary'
  | 'destination'

export type RecommendationReasonCategory =
  | 'traveler'
  | 'destination'
  | 'budget'
  | 'travel_style'
  | 'seasonality'
  | 'duration'
  | 'other'

export interface RecommendationReason {
  code: string
  message: string
  weight: number
  category: RecommendationReasonCategory
}

export interface RecommendationScoreComponents {
  travelerPreferences: number
  destinationPopularity: number
  budgetFit: number
  travelStyle: number
  seasonality: number
  tripDuration: number
}

export interface RecommendationScore {
  /** Composite 0–100. */
  overall: number
  components: RecommendationScoreComponents
  /** Confidence 0–1. */
  confidence: number
}

export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn'

export interface RecommendationContext {
  destination: string
  destinations: string[]
  locale: 'ar' | 'en'
  tripDurationDays: number | null
  /** 1–12 when known. */
  travelMonth: number | null
  season: SeasonName | null
  budgetAmount: number | null
  budgetCurrency: string | null
  travelerType: 'solo' | 'couple' | 'family' | 'friends' | 'business' | null
  travelStyle: string | null
  interests: string[]
  popularDestinations?: string[]
}

export interface RecommendationCandidateInput {
  id: string
  kind: RecommendationKind
  title: string
  estimatedCost?: number | null
  currency?: string | null
  durationDays?: number | null
  /** 0–1 destination/item popularity. */
  popularity?: number | null
  seasonalityTags?: SeasonName[]
  travelStyles?: string[]
  travelerTypes?: Array<'solo' | 'couple' | 'family' | 'friends' | 'business'>
  tags?: string[]
  destination?: string | null
  baseScore?: number | null
}

export interface Recommendation {
  id: string
  kind: RecommendationKind
  title: string
  candidateId: string
  rank: number
  score: RecommendationScore
  confidence: number
  reasons: RecommendationReason[]
  matchedPreferences: string[]
  unmatchedPreferences: string[]
}

export interface RecommendV1Request {
  context: RecommendationContext
  candidates: RecommendationCandidateInput[]
  maxResults?: number
  /** Optional explicit preference keys the user stated. */
  explicitPreferences?: string[]
  /** Optional inferred preference keys from behaviour. */
  inferredPreferences?: string[]
}

export interface RecommendV1Result {
  recommendations: Recommendation[]
  primary: Recommendation | null
  overallConfidence: number
}
