/**
 * Sprint 24 — Search Aggregation Engine types.
 * ExecutionPlan results → normalize → rank → recommend (no live APIs).
 */

import type { ExecutionPlan, ExecutionResult, ExecutionTask } from '../execution/types'
import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'

export type SearchOptionKind =
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'activity'
  | 'package'

export interface FlightOption {
  id: string
  kind: 'flight'
  from: string
  to: string
  airline: string
  cabin: string
  price: number
  currency: string
  stops: number
  /** Estimated duration hours (derived / mock). */
  durationHours: number
  providerId: string
  sourceTaskId: string
}

export interface HotelOption {
  id: string
  kind: 'hotel'
  name: string
  area: string
  stars: number
  nightly: number
  currency: string
  providerId: string
  sourceTaskId: string
}

export interface TransportOption {
  id: string
  kind: 'transport'
  mode: string
  from: string
  to: string
  price: number
  currency: string
  providerId: string
  sourceTaskId: string
}

export interface ActivityOption {
  id: string
  kind: 'activity'
  title: string
  category: string
  price: number
  currency: string
  providerId: string
  sourceTaskId: string
}

export interface PackageOption {
  id: string
  kind: 'package'
  title: string
  includes: string[]
  price: number
  currency: string
  providerId: string
  sourceTaskId: string
}

export type SearchOption =
  | FlightOption
  | HotelOption
  | TransportOption
  | ActivityOption
  | PackageOption

export interface SearchResult {
  id: string
  option: SearchOption
  score: number
  confidence: number
  factors: RankingFactorScores
  reasons: string[]
  rejected: boolean
  rejectReasons: string[]
}

export interface SearchCollection {
  id: string
  conversationId: string
  executionPlanId: string
  tripPlanId: string
  flights: FlightOption[]
  hotels: HotelOption[]
  transport: TransportOption[]
  activities: ActivityOption[]
  packages: PackageOption[]
  all: SearchOption[]
  createdAt: string
}

export interface RankingFactorScores {
  price: number
  duration: number
  stops: number
  hotelRating: number
  location: number
  budgetFit: number
  preferenceMatch: number
  tripGoals: number
}

export interface RecommendationCandidate {
  id: string
  kind: SearchOptionKind
  title: string
  score: number
  confidence: number
  option: SearchOption
  reasons: string[]
  factors: RankingFactorScores
}

export interface SearchRecommendation {
  top: RecommendationCandidate | null
  alternatives: RecommendationCandidate[]
  rejected: RecommendationCandidate[]
  reasoning: string[]
  confidenceScore: number
}

export interface AggregationTimelineEntry {
  id: string
  stage:
    | 'provider_results'
    | 'normalize'
    | 'deduplicate'
    | 'ranking'
    | 'scoring'
    | 'recommendation'
  at: string
  detail: string
  count?: number
}

export interface SearchAggregationTurnResult {
  collection: SearchCollection
  results: SearchResult[]
  recommendation: SearchRecommendation
  timeline: AggregationTimelineEntry[]
  providerCallCount: number
  rankedCount: number
}

export interface SearchAggregationContext {
  conversationId: string
  executionPlan: ExecutionPlan
  executionResults: ExecutionResult[]
  executionTasks?: ExecutionTask[]
  tripPlan?: EngineTripPlan | null
}

export interface SearchAggregationEngineOptions {
  conversationId?: string
  maxAlternatives?: number
}
