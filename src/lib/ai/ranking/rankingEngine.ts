/**
 * Phase AB — RankingEngine foundation (deterministic, interface-first).
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

    return ranked.sort((a, b) => b.rankScore - a.rankScore || b.confidence - a.confidence)
  }
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
