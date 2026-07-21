/**
 * Sprint 77 — rank itineraries and attach recommendation labels.
 */

import type { OptimizedItinerary, RecommendationLabel, TripOptimizerRecommendations } from './types'

function pickBest(
  list: OptimizedItinerary[],
  scoreOf: (item: OptimizedItinerary) => number,
): OptimizedItinerary | null {
  if (list.length === 0) return null
  return [...list].sort((a, b) => scoreOf(b) - scoreOf(a) || a.totalPrice - b.totalPrice)[0] ?? null
}

export function assignRecommendationLabels(
  itineraries: OptimizedItinerary[],
): { labeled: OptimizedItinerary[]; recommendations: TripOptimizerRecommendations } {
  const bestOverall = pickBest(itineraries, (i) => i.scores.journeyScore)
  const bestValue = pickBest(itineraries, (i) => {
    // value = journey quality per currency unit
    const price = Math.max(1, i.totalPrice)
    return i.scores.budgetScore * 0.6 + (i.scores.journeyScore / Math.sqrt(price / 1000)) * 0.4
  })
  const fastest = pickBest(itineraries, (i) => i.scores.travelTimeScore)
  const luxury = pickBest(itineraries, (i) => i.scores.luxuryScore)
  const business = pickBest(itineraries, (i) => i.scores.businessScore)
  const family = pickBest(itineraries, (i) => i.scores.familyScore)

  const labelMap = new Map<string, RecommendationLabel[]>()
  const add = (item: OptimizedItinerary | null, label: RecommendationLabel) => {
    if (!item) return
    const existing = labelMap.get(item.id) ?? []
    existing.push(label)
    labelMap.set(item.id, existing)
  }
  add(bestOverall, 'best_overall')
  add(bestValue, 'best_value')
  add(fastest, 'fastest')
  add(luxury, 'luxury')
  add(business, 'business')
  add(family, 'family')

  const labeled = [...itineraries]
    .map((item) => ({
      ...item,
      labels: labelMap.get(item.id) ?? [],
    }))
    .sort((a, b) => b.scores.journeyScore - a.scores.journeyScore || a.totalPrice - b.totalPrice)

  return {
    labeled,
    recommendations: {
      bestOverall: labeled.find((i) => i.id === bestOverall?.id) ?? null,
      bestValue: labeled.find((i) => i.id === bestValue?.id) ?? null,
      fastest: labeled.find((i) => i.id === fastest?.id) ?? null,
      luxury: labeled.find((i) => i.id === luxury?.id) ?? null,
      business: labeled.find((i) => i.id === business?.id) ?? null,
      family: labeled.find((i) => i.id === family?.id) ?? null,
    },
  }
}

export function rankItineraries(itineraries: OptimizedItinerary[]): OptimizedItinerary[] {
  return assignRecommendationLabels(itineraries).labeled
}
