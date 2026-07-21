/**
 * Sprint 79 — Autonomous Search & Decision Engine domain models.
 * Framework-agnostic; no imports from RahhalBrain or agent engines.
 */

export type SearchPlanObjective =
  | 'cheapest'
  | 'balanced'
  | 'fastest'
  | 'premium_comfort'
  | 'loyalty_friendly'

export type RecommendationLabel =
  | 'best_overall'
  | 'best_budget'
  | 'fastest'
  | 'best_comfort'
  | 'best_family'

export type ScoringDimension =
  | 'price'
  | 'duration'
  | 'layovers'
  | 'airport_quality'
  | 'departure_time'
  | 'arrival_time'
  | 'hotel_rating'
  | 'walking_distance'
  | 'review_quality'
  | 'refund_policy'
  | 'baggage'
  | 'overall_convenience'

export interface ScoringWeights {
  price: number
  duration: number
  layovers: number
  airport_quality: number
  departure_time: number
  arrival_time: number
  hotel_rating: number
  walking_distance: number
  review_quality: number
  refund_policy: number
  baggage: number
  overall_convenience: number
}

export interface SearchPlanConstraints {
  maxPrice: number | null
  maxDurationMinutes: number | null
  maxStops: number | null
  maxLayoverMinutes: number | null
  preferDirect: boolean
  minHotelStars: number | null
  maxWalkMinutes: number | null
  allowNearbyAirports: boolean
  requireRefundable: boolean
  loyaltyPreferred: boolean
}

export interface SearchPlan {
  id: string
  label: string
  objective: SearchPlanObjective
  priorityWeights: ScoringWeights
  acceptableConstraints: SearchPlanConstraints
  providerOrder: string[]
  fallbackStrategy: string
  confidence: number
}

export interface FlightCandidateFacts {
  id: string
  providerId: string
  airline: string
  price: number
  currency: string
  durationMinutes: number | null
  stops: number
  layoverMinutes: number | null
  departureHour: number | null
  arrivalHour: number | null
  cabin: string | null
  baggageIncluded: boolean
  refundable: boolean
  airportQuality: number | null
  loyaltyMatch: boolean
  payload: Record<string, unknown>
}

export interface HotelCandidateFacts {
  id: string
  providerId: string
  name: string
  price: number
  currency: string
  stars: number | null
  rating: number | null
  walkMinutes: number | null
  reviewQuality: number | null
  refundable: boolean
  familyFriendly: boolean
  payload: Record<string, unknown>
}

export interface SearchCandidate {
  id: string
  planId: string
  providerId: string
  title: string
  totalPrice: number
  currency: string
  flight: FlightCandidateFacts
  hotel: HotelCandidateFacts
  normalizedKey: string
  score: SearchScore | null
  reasons: DecisionReason[]
  labels: RecommendationLabel[]
}

export interface SearchScore {
  overall: number
  dimensions: Record<ScoringDimension, number>
  weighted: ScoringWeights
  confidence: number
}

export interface DecisionReason {
  code: string
  message: string
  impact: 'positive' | 'negative' | 'neutral'
  delta?: number | null
}

export interface RecommendationBundle {
  bestOverall: SearchCandidate | null
  bestBudget: SearchCandidate | null
  fastest: SearchCandidate | null
  bestComfort: SearchCandidate | null
  bestFamily: SearchCandidate | null
  explanation: string
  confidence: number
  ranked: SearchCandidate[]
}

export type DecisionEventName =
  | 'search.plan.created'
  | 'search.plan.executed'
  | 'candidate.generated'
  | 'candidate.scored'
  | 'candidate.selected'

export interface DecisionEvent {
  name: DecisionEventName
  at: string
  payload: Record<string, unknown>
}

export interface DecisionEngineResult {
  version: string
  plans: SearchPlan[]
  candidates: SearchCandidate[]
  recommendations: RecommendationBundle
  events: DecisionEvent[]
  durationMs: number
  duplicateCount: number
  fallbackUsed: boolean
}

export const SPRINT79_DECISION_ENGINE_VERSION = '1.0.0-decision'
