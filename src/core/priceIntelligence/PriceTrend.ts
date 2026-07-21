/**
 * Sprint 81 — price trend + volatility from historical observations.
 */

import type { PriceObservation, PriceTrendDirection } from './TimingRecommendation'

export interface PriceTrendResult {
  trend: PriceTrendDirection
  volatility: number
  average: number | null
  slope: number
  sampleSize: number
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Coefficient of variation (0–1+), capped for scoring. */
export function computeVolatility(prices: number[]): number {
  if (prices.length < 2) return 0
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  if (mean <= 0) return 0
  return Math.min(1.5, stddev(prices) / mean)
}

/** Simple linear slope of price vs index (normalized by mean). */
export function computeSlope(prices: number[]): number {
  if (prices.length < 2) return 0
  const n = prices.length
  const meanY = prices.reduce((a, b) => a + b, 0) / n
  if (meanY <= 0) return 0
  let num = 0
  let den = 0
  const meanX = (n - 1) / 2
  for (let i = 0; i < n; i += 1) {
    num += (i - meanX) * (prices[i]! - meanY)
    den += (i - meanX) ** 2
  }
  if (den === 0) return 0
  return (num / den) / meanY
}

export function analyzePriceTrend(observations: PriceObservation[]): PriceTrendResult {
  const sorted = [...observations]
    .filter((o) => Number.isFinite(o.price) && o.price > 0)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
  const prices = sorted.map((o) => o.price)
  const sampleSize = prices.length
  if (sampleSize === 0) {
    return { trend: 'stable', volatility: 0, average: null, slope: 0, sampleSize: 0 }
  }
  const average = prices.reduce((a, b) => a + b, 0) / sampleSize
  const volatility = computeVolatility(prices)
  const slope = computeSlope(prices)

  let trend: PriceTrendDirection = 'stable'
  if (volatility >= 0.18) {
    trend = 'volatile'
  } else if (slope >= 0.04) {
    trend = 'rising'
  } else if (slope <= -0.04) {
    trend = 'falling'
  }

  return { trend, volatility, average, slope, sampleSize }
}
