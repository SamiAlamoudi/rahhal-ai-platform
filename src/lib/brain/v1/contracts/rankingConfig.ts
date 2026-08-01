/**
 * Sprint 88 Task 2 — Ranking / XAI config contracts (interfaces only).
 * Extends Brain RecommendationEngine weight keys without changing its runtime.
 * Weights are configurable — not hard-coded around a destination set.
 */

import {
  DEFAULT_RANKING_WEIGHTS,
  type RankingWeights,
} from '../RecommendationEngine'

/** Core weights already used by RecommendationEngine (Sprint 82). */
export type CoreRankingWeightKey = keyof RankingWeights

/**
 * Extended configurable keys for Trip Explainability Graph / domain rankers (90+).
 * Optional — absent keys do not affect Sprint 82 RecommendationEngine until migrated.
 */
export type ExtendedRankingWeightKey =
  | CoreRankingWeightKey
  | 'valueForMoney'
  | 'scheduleConvenience'
  | 'baggage'
  | 'hotelLocation'
  | 'hotelRating'
  | 'tripPurpose'
  | 'familySuitability'
  | 'accessibility'
  | 'providerConfidence'
  | 'reliability'

export type RankingConfig = Partial<Record<ExtendedRankingWeightKey, number>>

export const RANKING_CONFIG_CONTRACT_VERSION = 'sprint88-ranking-config-1' as const

/** Defaults mirror RecommendationEngine; extended keys omitted until domain impl. */
export const DEFAULT_RANKING_CONFIG: RankingWeights = { ...DEFAULT_RANKING_WEIGHTS }

export const EXTENDED_RANKING_WEIGHT_KEYS: readonly ExtendedRankingWeightKey[] = [
  'price',
  'stops',
  'travelTime',
  'refundability',
  'airlineQuality',
  'hotelQuality',
  'travelerPreferences',
  'historicalChoices',
  'valueForMoney',
  'scheduleConvenience',
  'baggage',
  'hotelLocation',
  'hotelRating',
  'tripPurpose',
  'familySuitability',
  'accessibility',
  'providerConfidence',
  'reliability',
] as const

/** Merge overrides onto core defaults (pure; no side effects). */
export function mergeRankingConfig(
  overrides: RankingConfig = {},
): RankingWeights & RankingConfig {
  return {
    ...DEFAULT_RANKING_CONFIG,
    ...overrides,
  }
}

/** Sum of core default weights (must stay 1.0 for RecommendationEngine parity). */
export function sumCoreRankingDefaults(): number {
  return Object.values(DEFAULT_RANKING_CONFIG).reduce((a, b) => a + b, 0)
}
