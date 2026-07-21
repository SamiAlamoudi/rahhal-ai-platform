/**
 * Sprint 79 — rank candidates and attach recommendation labels.
 */

import type { RecommendationLabel, SearchCandidate } from '../types'

function pick(
  list: SearchCandidate[],
  scoreOf: (c: SearchCandidate) => number,
): SearchCandidate | null {
  if (list.length === 0) return null
  return [...list].sort((a, b) => scoreOf(b) - scoreOf(a) || a.totalPrice - b.totalPrice)[0] ?? null
}

export function rankCandidates(candidates: SearchCandidate[]): {
  ranked: SearchCandidate[]
  labels: Record<string, RecommendationLabel[]>
} {
  const ranked = [...candidates].sort((a, b) => {
    const sa = a.score?.overall ?? 0
    const sb = b.score?.overall ?? 0
    return sb - sa || a.totalPrice - b.totalPrice
  })

  const bestOverall = pick(ranked, (c) => c.score?.overall ?? 0)
  const bestBudget = pick(ranked, (c) => {
    const priceDim = c.score?.dimensions.price ?? 0
    return priceDim * 0.7 + (1000 / Math.max(1, c.totalPrice)) * 30
  })
  const fastest = pick(ranked, (c) => {
    const duration = c.flight.durationMinutes ?? 9999
    return (c.score?.dimensions.duration ?? 0) * 0.6 + (10000 / Math.max(1, duration)) * 40
  })
  const bestComfort = pick(ranked, (c) => {
    const d = c.score?.dimensions
    return (d?.hotel_rating ?? 0) * 0.35
      + (d?.overall_convenience ?? 0) * 0.35
      + (d?.walking_distance ?? 0) * 0.15
      + (d?.baggage ?? 0) * 0.15
  })
  const bestFamily = pick(ranked, (c) => {
    const familyBoost = c.hotel.familyFriendly ? 20 : 0
    const d = c.score?.dimensions
    return familyBoost
      + (d?.layovers ?? 0) * 0.25
      + (d?.hotel_rating ?? 0) * 0.25
      + (d?.walking_distance ?? 0) * 0.2
      + (d?.arrival_time ?? 0) * 0.15
  })

  const labels = new Map<string, RecommendationLabel[]>()
  const add = (c: SearchCandidate | null, label: RecommendationLabel) => {
    if (!c) return
    const existing = labels.get(c.id) ?? []
    existing.push(label)
    labels.set(c.id, existing)
  }
  add(bestOverall, 'best_overall')
  add(bestBudget, 'best_budget')
  add(fastest, 'fastest')
  add(bestComfort, 'best_comfort')
  add(bestFamily, 'best_family')

  const withLabels = ranked.map((c) => ({
    ...c,
    labels: labels.get(c.id) ?? [],
  }))

  const labelRecord: Record<string, RecommendationLabel[]> = {}
  for (const [id, list] of labels) labelRecord[id] = list

  return { ranked: withLabels, labels: labelRecord }
}

export function pickRecommendationBundle(ranked: SearchCandidate[]): {
  bestOverall: SearchCandidate | null
  bestBudget: SearchCandidate | null
  fastest: SearchCandidate | null
  bestComfort: SearchCandidate | null
  bestFamily: SearchCandidate | null
} {
  const byLabel = (label: RecommendationLabel) => ranked.find((c) => c.labels.includes(label)) ?? null
  return {
    bestOverall: byLabel('best_overall'),
    bestBudget: byLabel('best_budget'),
    fastest: byLabel('fastest'),
    bestComfort: byLabel('best_comfort'),
    bestFamily: byLabel('best_family'),
  }
}
