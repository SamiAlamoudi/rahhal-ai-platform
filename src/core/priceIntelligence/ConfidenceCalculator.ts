/**
 * Sprint 81 — timing confidence from analysis signals (0–100).
 */

import type { PriceAnalysisSnapshot, PriceTrendDirection } from './TimingRecommendation'

export interface ConfidenceFactors {
  observationCount: number
  volatility: number
  daysToDeparture: number | null
  trend: PriceTrendDirection
  hasBudget: boolean
  demandKnown: boolean
  seasonKnown: boolean
  availabilityKnown: boolean
}

/** Map discrete factors onto a 0–100 confidence score. */
export function calculateTimingConfidence(factors: ConfidenceFactors): number {
  let score = 35

  // Sample size
  if (factors.observationCount >= 8) score += 22
  else if (factors.observationCount >= 4) score += 16
  else if (factors.observationCount >= 2) score += 10
  else if (factors.observationCount === 1) score += 4
  else score -= 12

  // Volatility reduces confidence
  if (factors.volatility >= 0.25) score -= 18
  else if (factors.volatility >= 0.15) score -= 10
  else if (factors.volatility >= 0.08) score -= 4
  else score += 6

  // Clear trend helps (except pure volatile)
  if (factors.trend === 'rising' || factors.trend === 'falling') score += 8
  else if (factors.trend === 'stable') score += 5
  else score -= 8

  // Booking window clarity
  if (factors.daysToDeparture != null) {
    if (factors.daysToDeparture <= 3) score += 4
    else if (factors.daysToDeparture <= 14) score += 8
    else if (factors.daysToDeparture <= 45) score += 10
    else score += 6
  } else {
    score -= 6
  }

  if (factors.hasBudget) score += 5
  if (factors.demandKnown) score += 4
  if (factors.seasonKnown) score += 3
  if (factors.availabilityKnown) score += 5

  return Math.max(5, Math.min(98, Math.round(score)))
}

export function confidenceFromAnalysis(
  analysis: PriceAnalysisSnapshot,
  extras?: { hasBudget?: boolean; availabilityKnown?: boolean },
): number {
  return calculateTimingConfidence({
    observationCount: analysis.observationCount,
    volatility: analysis.volatility,
    daysToDeparture: analysis.daysToDeparture,
    trend: analysis.trend,
    hasBudget: extras?.hasBudget ?? analysis.priceVsBudgetRatio != null,
    demandKnown: true,
    seasonKnown: true,
    availabilityKnown: extras?.availabilityKnown ?? false,
  })
}
