/**
 * Sprint 77 — Trip Optimizer diagnostics builder.
 */

import type {
  OptimizedItinerary,
  OptimizationPriority,
  TripOptimizerDiagnostics,
} from './types'

export function buildTripOptimizerDiagnostics(input: {
  itineraries: OptimizedItinerary[]
  priority: OptimizationPriority
  budgetEffect: number
  personalizationEffect: number
}): TripOptimizerDiagnostics {
  const top = input.itineraries[0] ?? null
  return {
    journeyScore: top?.scores.journeyScore ?? null,
    optimizationFactors: top?.factors ?? [],
    rankingBreakdown: input.itineraries.slice(0, 8).map((item) => ({
      itineraryId: item.id,
      label: item.labels[0] ?? null,
      scores: item.scores,
      factors: item.factors,
    })),
    budgetEffect: input.budgetEffect,
    personalizationEffect: input.personalizationEffect,
    tradeoffs: input.itineraries.flatMap((i) => i.tradeoffs).slice(0, 12),
    priority: input.priority,
    itineraryCount: input.itineraries.length,
  }
}
