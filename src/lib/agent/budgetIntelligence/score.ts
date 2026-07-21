/**
 * Sprint 75 — Budget Score (price fit, value, quality, savings, travel time).
 */

import type { BudgetIntent, BudgetScoreBreakdown } from './types'

export interface ScoreBudgetInput {
  price: number
  budgetCap: number | null
  budgetMin?: number | null
  /** Higher is better quality (0–100). */
  qualityHint?: number | null
  /** Duration minutes for flights; null for hotels. */
  durationMinutes?: number | null
  intent?: BudgetIntent
  style?: 'luxury' | 'midrange' | 'budget' | null
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

export function computeBudgetScore(input: ScoreBudgetInput): BudgetScoreBreakdown {
  const price = Math.max(0, input.price)
  const cap = input.budgetCap != null && input.budgetCap > 0 ? input.budgetCap : null
  const min = input.budgetMin != null && input.budgetMin > 0 ? input.budgetMin : null
  const intent = input.intent ?? 'under_cap'
  const style = input.style

  let priceFit = 70
  let savings = 50

  if (cap != null) {
    const ratio = price / cap
    if (ratio <= 0.55) {
      priceFit = 98
      savings = 95
    } else if (ratio <= 0.75) {
      priceFit = 88
      savings = 80
    } else if (ratio <= 0.92) {
      priceFit = 78
      savings = 65
    } else if (ratio <= 1) {
      priceFit = 68
      savings = 45
    } else if (ratio <= 1.15) {
      priceFit = 35
      savings = 15
    } else {
      priceFit = 10
      savings = 0
    }
  }

  if (min != null && price < min * 0.85) {
    // Too cheap vs stated floor — slight quality suspicion
    priceFit = Math.min(priceFit, 72)
  }

  if (intent === 'cheapest') {
    // Prefer lower absolute price when cap unknown
    if (cap == null) {
      priceFit = clamp(100 - Math.log10(price + 10) * 18)
      savings = priceFit
    } else {
      priceFit = clamp(priceFit + (1 - price / cap) * 20)
    }
  }

  if (intent === 'luxury' || style === 'luxury') {
    // Luxury travelers tolerate higher spend if quality is high
    if (cap != null && price <= cap) priceFit = clamp(priceFit + 5)
  }

  const qualityHint = input.qualityHint ?? 60
  let tripQuality = clamp(qualityHint)

  let value = clamp((priceFit * 0.55) + (tripQuality * 0.45))
  if (intent === 'best_value') {
    value = clamp(value + 8)
  }

  let travelTime = 70
  if (input.durationMinutes != null) {
    const hours = input.durationMinutes / 60
    if (hours <= 4) travelTime = 95
    else if (hours <= 8) travelTime = 80
    else if (hours <= 14) travelTime = 60
    else travelTime = 40
  }

  // Weighted budget score
  const budgetScore = clamp(
    priceFit * 0.32
    + value * 0.22
    + tripQuality * 0.18
    + savings * 0.16
    + travelTime * 0.12,
  )

  return {
    priceFit: Math.round(priceFit),
    value: Math.round(value),
    tripQuality: Math.round(tripQuality),
    savings: Math.round(savings),
    travelTime: Math.round(travelTime),
    budgetScore: Math.round(budgetScore),
  }
}
