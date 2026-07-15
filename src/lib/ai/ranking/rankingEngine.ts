/**
 * Phase AC — RankingEngine with weighted ranking, tie-breaking, and
 * deterministic ordering.
 */

import { defaultPreferenceWeights } from '../preferences/types'
import type { RankableItem, RankedItem, RankingEngine, RankingInput } from './types'

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function normalizeScore(value: number | null | undefined, fallback = 0.5): number {
  if (value == null || Number.isNaN(value)) return fallback
  if (value > 1) return clamp01(value / 100)
  return clamp01(value)
}

export interface RankingOptions {
  /** Stable locale for explanation text. */
  locale?: 'ar' | 'en'
}

export class DefaultRankingEngine implements RankingEngine {
  rank(input: RankingInput): RankedItem[] {
    const weights = { ...defaultPreferenceWeights(), ...input.weights }
    const weightSum = Math.max(
      0.0001,
      weights.price + weights.comfort + weights.time + weights.rating + weights.personalization,
    )

    const ranked = input.items.map((item): RankedItem => {
      const priceScore = item.price == null
        ? normalizeScore(item.baseScore)
        : clamp01(1 - Math.min(1, item.price / 10_000))
      const comfort = normalizeScore(item.comfort, normalizeScore(item.baseScore))
      const time = normalizeScore(item.timeEfficiency, 0.5)
      const rating = normalizeScore(item.rating, 0.5)
      const personal = normalizeScore(item.personalizationFit, 0.5)

      const rankScore = (
        priceScore * weights.price
        + comfort * weights.comfort
        + time * weights.time
        + rating * weights.rating
        + personal * weights.personalization
      ) / weightSum

      const confidence = clamp01((normalizeScore(item.baseScore) + personal + rating) / 3)
      const explanation = buildExplanation(item, {
        priceScore, comfort, time, rating, personal, rankScore,
      }, input.locale ?? 'en')

      return {
        ...item,
        rankScore: Number(rankScore.toFixed(4)),
        confidence: Number(confidence.toFixed(4)),
        explanation,
      }
    })

    return stableSort(ranked)
  }
}

/** Deterministic ordering: score → confidence → kind → id. */
export function stableSort(items: RankedItem[]): RankedItem[] {
  return [...items].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.id.localeCompare(b.id)
  })
}

/** Break ties using a secondary key without mutating scores. */
export function breakTies(items: RankedItem[], preferKinds: RankedItem['kind'][] = []): RankedItem[] {
  const priority = new Map(preferKinds.map((k, i) => [k, preferKinds.length - i]))
  return [...items].sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore
    const pa = priority.get(a.kind) ?? 0
    const pb = priority.get(b.kind) ?? 0
    if (pb !== pa) return pb - pa
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return a.id.localeCompare(b.id)
  })
}

function buildExplanation(
  item: RankableItem,
  scores: Record<string, number>,
  locale: 'ar' | 'en',
): string[] {
  if (locale === 'ar') {
    return [
      `الترتيب ${scores.rankScore.toFixed(2)} للعنصر ${item.id}`,
      `الراحة=${scores.comfort.toFixed(2)} · الوقت=${scores.time.toFixed(2)} · السعر=${scores.priceScore.toFixed(2)}`,
    ]
  }
  return [
    `Rank score ${scores.rankScore.toFixed(2)} for ${item.id}`,
    `comfort=${scores.comfort.toFixed(2)} time=${scores.time.toFixed(2)} price=${scores.priceScore.toFixed(2)}`,
  ]
}

export function createRankingEngine(): RankingEngine {
  return new DefaultRankingEngine()
}

/** Alias used by Phase AC naming. */
export class RankingEngineImpl extends DefaultRankingEngine {}
