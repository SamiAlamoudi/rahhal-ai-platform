/**
 * Sprint 81 — analyze current prices against pool + history + calendar signals.
 */

import { analyzePriceTrend } from './PriceTrend'
import type {
  DemandLevel,
  PriceAnalysisSnapshot,
  PriceIntelligenceInput,
  PriceObservation,
  TripSeason,
} from './TimingRecommendation'

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function inferWeekend(departure: Date | null, explicit: boolean | null | undefined): boolean {
  if (typeof explicit === 'boolean') return explicit
  if (!departure) return false
  const day = departure.getUTCDay()
  return day === 5 || day === 6 || day === 0
}

/** Lightweight holiday heuristic (fixed + common travel peaks). */
export function isHolidayDate(date: Date | null, explicit: boolean | null | undefined): boolean {
  if (typeof explicit === 'boolean') return explicit
  if (!date) return false
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  // New Year, Eid-adjacent windows approximated, Christmas/NY, National Day (SA Sep 23)
  if (month === 1 && day <= 5) return true
  if (month === 12 && day >= 20) return true
  if (month === 9 && day >= 20 && day <= 26) return true
  if (month === 7 && day >= 1 && day <= 10) return true // summer peak proxy
  return false
}

function inferSeason(
  departure: Date | null,
  explicit: TripSeason | null | undefined,
  holiday: boolean,
): TripSeason {
  if (explicit) return explicit
  if (!departure) return holiday ? 'peak' : 'shoulder'
  const month = departure.getUTCMonth() + 1
  if (holiday) return 'peak'
  if ([6, 7, 8, 12].includes(month)) return 'peak'
  if ([3, 4, 10, 11].includes(month)) return 'shoulder'
  return 'off'
}

function buildObservations(input: PriceIntelligenceInput): PriceObservation[] {
  const currency = input.currency || 'SAR'
  const base = [...(input.historicalObservations ?? [])]
  if (base.length === 0) {
    // Soft synthetic history from current offer pool so reasoning still works.
    const now = input.bookingDate ?? new Date().toISOString()
    if (input.cheapestPrice != null) {
      base.push({ price: input.cheapestPrice, currency, observedAt: now, source: 'pool_cheapest' })
    }
    if (input.premiumPrice != null) {
      base.push({ price: input.premiumPrice, currency, observedAt: now, source: 'pool_premium' })
    }
    base.push({ price: input.currentPrice, currency, observedAt: now, source: 'current' })
  }
  return base.filter((o) => Number.isFinite(o.price) && o.price > 0)
}

export function analyzePrices(input: PriceIntelligenceInput): PriceAnalysisSnapshot {
  const observations = buildObservations(input)
  const trendResult = analyzePriceTrend(observations)
  const prices = observations.map((o) => o.price)
  const cheapestFromHistory = prices.length ? Math.min(...prices) : null
  const premiumFromHistory = prices.length ? Math.max(...prices) : null

  const cheapestOption = input.cheapestPrice ?? cheapestFromHistory
  const premiumOption = input.premiumPrice ?? premiumFromHistory
  const average = trendResult.average

  const booking = parseDate(input.bookingDate) ?? new Date()
  const departure = parseDate(input.departureDate)
  const daysToDeparture = departure ? daysBetween(booking, departure) : null
  const isWeekendTravel = inferWeekend(departure, input.isWeekendTravel)
  const isHolidayPeriod = isHolidayDate(departure, input.isHolidayPeriod)
  const season = inferSeason(departure, input.tripSeason, isHolidayPeriod)
  const demand: DemandLevel = input.demandIndicator
    ?? (isHolidayPeriod || season === 'peak' || isWeekendTravel ? 'high' : 'medium')

  const priceVsAverageRatio = average && average > 0
    ? input.currentPrice / average
    : null
  const priceVsBudgetRatio = input.budgetCap && input.budgetCap > 0
    ? input.currentPrice / input.budgetCap
    : null

  return {
    currentPrice: input.currentPrice,
    averageObservedPrice: average,
    cheapestOption,
    premiumOption,
    priceVsAverageRatio,
    priceVsBudgetRatio,
    volatility: trendResult.volatility,
    trend: trendResult.trend,
    daysToDeparture,
    bookingWindowDays: daysToDeparture,
    demand,
    season,
    isWeekendTravel,
    isHolidayPeriod,
    observationCount: trendResult.sampleSize,
  }
}
