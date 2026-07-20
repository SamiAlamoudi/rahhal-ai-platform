/**
 * Sprint 43 — merge / rank recommendations across tool results.
 * Factors: price, quality, refund flexibility, supplier score, travel time,
 * loyalty value, user preferences.
 */

import type {
  OrchestratorMemorySnapshot,
  RankedRecommendation,
  ToolExecutionResult,
} from './types'

export function rankRecommendations(input: {
  toolResults: ToolExecutionResult[]
  memory: OrchestratorMemorySnapshot
  preferCheapest?: boolean
}): RankedRecommendation[] {
  const merged = input.toolResults.flatMap((r) => r.recommendations)
  if (!merged.length) return []

  const scored = merged.map((rec) => scoreOne(rec, input.memory, input.preferCheapest === true))
  scored.sort((a, b) => b.score - a.score)

  // Stable unique by id keeping highest score.
  const seen = new Set<string>()
  const out: RankedRecommendation[] = []
  for (const row of scored) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

function scoreOne(
  rec: RankedRecommendation,
  memory: OrchestratorMemorySnapshot,
  preferCheapest: boolean,
): RankedRecommendation {
  const priceScore = priceToScore(rec.price, memory.budget.amount, preferCheapest)
  const timeScore =
    rec.travelTimeHours == null
      ? 0.5
      : Math.max(0, 1 - Math.min(rec.travelTimeHours, 24) / 24)

  let preferenceMatch = rec.preferenceMatch
  const titleLower = rec.title.toLowerCase()
  for (const airline of memory.preferredAirlines) {
    if (titleLower.includes(airline.toLowerCase())) preferenceMatch = Math.max(preferenceMatch, 0.9)
  }
  for (const hotel of memory.hotelPreferences) {
    if (titleLower.includes(hotel.toLowerCase())) preferenceMatch = Math.max(preferenceMatch, 0.9)
  }

  const weights = preferCheapest
    ? {
        price: 0.35,
        quality: 0.1,
        refund: 0.15,
        supplier: 0.15,
        time: 0.05,
        loyalty: 0.1,
        preference: 0.1,
      }
    : {
        price: 0.18,
        quality: 0.18,
        refund: 0.12,
        supplier: 0.15,
        time: 0.12,
        loyalty: 0.1,
        preference: 0.15,
      }

  const score =
    priceScore * weights.price
    + clamp01(rec.quality) * weights.quality
    + clamp01(rec.refundFlexibility) * weights.refund
    + clamp01(rec.supplierScore) * weights.supplier
    + timeScore * weights.time
    + clamp01(rec.loyaltyValue) * weights.loyalty
    + clamp01(preferenceMatch) * weights.preference

  const reasons = [...rec.reasons]
  if (preferCheapest && rec.price != null) reasons.push('Optimized for lower price')
  if (preferenceMatch >= 0.8) reasons.push('Matches remembered preferences')
  if (rec.refundFlexibility >= 0.7) reasons.push('Flexible refund terms')
  if (rec.loyaltyValue >= 0.6) reasons.push('Strong loyalty value')

  return {
    ...rec,
    preferenceMatch,
    score: Math.round(score * 1000) / 1000,
    reasons: uniqueReasons(reasons),
  }
}

function priceToScore(
  price: number | null,
  budget: number | null,
  preferCheapest: boolean,
): number {
  if (price == null) return 0.5
  if (budget != null && budget > 0) {
    const ratio = price / budget
    if (ratio <= 0.5) return 1
    if (ratio <= 1) return preferCheapest ? 0.85 : 0.75
    if (ratio <= 1.25) return 0.4
    return 0.15
  }
  // No budget: cheaper-ish relative bands for demo ranking only.
  if (price < 800) return preferCheapest ? 1 : 0.85
  if (price < 1600) return 0.65
  if (price < 3000) return 0.4
  return 0.2
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function uniqueReasons(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    if (!out.includes(v)) out.push(v)
  }
  return out
}
