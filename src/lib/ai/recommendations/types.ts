/**
 * Phase AB — RecommendationEngine interfaces only (+ lightweight deterministic helpers).
 */

import type { PersonalizationProfile } from '../preferences/types'
import type { RankedItem } from '../ranking/types'

export interface RecommendationCandidate {
  id: string
  kind: 'flight' | 'hotel' | 'activity' | 'itinerary'
  title: string
  score: number
  confidence: number
  whySelected: string[]
  whyAlternativesRejected: string[]
  payload?: Record<string, unknown>
}

export interface RecommendationRequest {
  destination: string
  destinations?: string[]
  locale?: 'ar' | 'en'
  candidates: Array<{
    id: string
    kind: RecommendationCandidate['kind']
    title: string
    baseScore: number
    price?: number | null
    comfort?: number | null
    timeEfficiency?: number | null
    rating?: number | null
  }>
  profile?: PersonalizationProfile | null
  maxResults?: number
}

export interface RecommendationResult {
  primary: RecommendationCandidate | null
  alternatives: RecommendationCandidate[]
  overallConfidence: number
  explanations: string[]
  ranked: RankedItem[]
}

export interface RecommendationEngine {
  recommend(request: RecommendationRequest): RecommendationResult
}
