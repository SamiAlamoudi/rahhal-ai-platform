/**
 * Sprint 77 — Complete Trip Optimizer contracts (additive).
 */

export type OptimizationPriority =
  | 'comfort'
  | 'convenience'
  | 'value'
  | 'speed'
  | 'luxury'
  | 'business'
  | 'family'
  | 'budget'
  | 'balanced'

export type RecommendationLabel =
  | 'best_overall'
  | 'best_value'
  | 'fastest'
  | 'luxury'
  | 'business'
  | 'family'

export interface JourneyScoreBreakdown {
  journeyScore: number
  budgetScore: number
  comfortScore: number
  convenienceScore: number
  businessScore: number
  familyScore: number
  luxuryScore: number
  travelTimeScore: number
}

export interface OptimizationFactorScore {
  name: string
  score: number
  weight: number
  note?: string
}

export interface RankingBreakdownEntry {
  itineraryId: string
  label: RecommendationLabel | null
  scores: JourneyScoreBreakdown
  factors: OptimizationFactorScore[]
}

export interface TripOptimizerTradeoff {
  kind: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface TripOptimizerDiagnostics {
  journeyScore: number | null
  optimizationFactors: OptimizationFactorScore[]
  rankingBreakdown: RankingBreakdownEntry[]
  budgetEffect: number
  personalizationEffect: number
  tradeoffs: TripOptimizerTradeoff[]
  priority: OptimizationPriority
  itineraryCount: number
}

export interface OptimizedItinerary {
  id: string
  title: string
  flightId: string
  hotelId: string
  totalPrice: number
  currency: string
  scores: JourneyScoreBreakdown
  factors: OptimizationFactorScore[]
  labels: RecommendationLabel[]
  reasons: string[]
  tradeoffs: TripOptimizerTradeoff[]
  flight: Record<string, unknown>
  hotel: Record<string, unknown>
}

export interface TripOptimizerRecommendations {
  bestOverall: OptimizedItinerary | null
  bestValue: OptimizedItinerary | null
  fastest: OptimizedItinerary | null
  luxury: OptimizedItinerary | null
  business: OptimizedItinerary | null
  family: OptimizedItinerary | null
}

export interface TripOptimizerResult {
  version: string
  diagnostics: TripOptimizerDiagnostics
  itineraries: OptimizedItinerary[]
  recommendations: TripOptimizerRecommendations
  recommendationFacts: string[]
  durationMs: number
}

export const SPRINT77_TRIP_OPTIMIZER_VERSION = '1.0.0-trip-optimizer'
