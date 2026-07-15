/**
 * Phase AB — RankingEngine interfaces (personalization-aware ranking overlay).
 */

import type { PreferenceWeights } from '../preferences/types'

export interface RankableItem {
  id: string
  kind: 'flight' | 'hotel' | 'activity' | 'itinerary'
  baseScore: number
  price?: number | null
  comfort?: number | null
  timeEfficiency?: number | null
  rating?: number | null
  personalizationFit?: number | null
  meta?: Record<string, unknown>
}

export interface RankedItem extends RankableItem {
  rankScore: number
  confidence: number
  explanation: string[]
}

export interface RankingInput {
  items: RankableItem[]
  weights?: PreferenceWeights
  locale?: 'ar' | 'en'
}

export interface RankingEngine {
  rank(input: RankingInput): RankedItem[]
}
