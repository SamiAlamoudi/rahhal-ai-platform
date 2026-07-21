/**
 * Sprint 75 — rank flights / hotels / packages by Budget Score.
 */

import { computeBudgetScore } from './score'
import type { BudgetIntent, BudgetScoreBreakdown, RankedBudgetCandidate } from './types'

export interface FlightBudgetRow {
  id: string
  title: string
  price: number
  currency: string
  durationMinutes?: number | null
  stops?: number | null
  airline?: string | null
  cabin?: string | null
  payload?: Record<string, unknown>
}

export interface HotelBudgetRow {
  id: string
  title: string
  price: number
  currency: string
  rating?: number | null
  stars?: number | null
  payload?: Record<string, unknown>
}

export interface PackageBudgetRow {
  id: string
  title: string
  price: number
  currency: string
  flightDurationMinutes?: number | null
  hotelRating?: number | null
  payload?: Record<string, unknown>
}

export interface RankBudgetOptions {
  budgetCap: number | null
  budgetMin?: number | null
  intent?: BudgetIntent
  style?: 'luxury' | 'midrange' | 'budget' | null
}

function flightQuality(row: FlightBudgetRow): number {
  let q = 70
  if ((row.stops ?? 1) === 0) q += 15
  else if ((row.stops ?? 0) >= 2) q -= 12
  if (row.cabin === 'business' || row.cabin === 'first') q += 12
  if (row.cabin === 'premium_economy') q += 6
  return Math.max(0, Math.min(100, q))
}

function hotelQuality(row: HotelBudgetRow): number {
  const rating = row.rating ?? null
  const stars = row.stars ?? null
  let q = 60
  if (rating != null) {
    if (rating > 5) q = rating * 10 // 0–10 scale
    else q = rating * 20 // 0–5 scale
  }
  if (stars != null) q = Math.max(q, stars * 18)
  return Math.max(0, Math.min(100, q))
}

function reasonsFrom(score: BudgetScoreBreakdown, price: number, cap: number | null): string[] {
  const reasons: string[] = []
  if (cap != null) {
    if (price <= cap) reasons.push(`within budget (${price} ≤ ${cap})`)
    else reasons.push(`over budget by ${Math.round(price - cap)}`)
  }
  if (score.savings >= 80) reasons.push('strong savings')
  if (score.tripQuality >= 80) reasons.push('high trip quality')
  if (score.travelTime >= 85) reasons.push('efficient travel time')
  if (score.value >= 80) reasons.push('best value profile')
  return reasons
}

export function rankFlightsByBudget(
  rows: FlightBudgetRow[],
  options: RankBudgetOptions,
): RankedBudgetCandidate[] {
  return rows
    .map((row) => {
      const score = computeBudgetScore({
        price: row.price,
        budgetCap: options.budgetCap,
        budgetMin: options.budgetMin,
        qualityHint: flightQuality(row),
        durationMinutes: row.durationMinutes ?? null,
        intent: options.intent,
        style: options.style,
      })
      return {
        id: row.id,
        kind: 'flight' as const,
        title: row.title,
        price: row.price,
        currency: row.currency,
        score,
        reasons: reasonsFrom(score, row.price, options.budgetCap),
        payload: row.payload ?? { airline: row.airline, stops: row.stops, cabin: row.cabin },
      }
    })
    .sort((a, b) => b.score.budgetScore - a.score.budgetScore)
}

export function rankHotelsByBudget(
  rows: HotelBudgetRow[],
  options: RankBudgetOptions,
): RankedBudgetCandidate[] {
  return rows
    .map((row) => {
      const score = computeBudgetScore({
        price: row.price,
        budgetCap: options.budgetCap,
        budgetMin: options.budgetMin,
        qualityHint: hotelQuality(row),
        durationMinutes: null,
        intent: options.intent,
        style: options.style,
      })
      return {
        id: row.id,
        kind: 'hotel' as const,
        title: row.title,
        price: row.price,
        currency: row.currency,
        score,
        reasons: reasonsFrom(score, row.price, options.budgetCap),
        payload: row.payload ?? { rating: row.rating, stars: row.stars },
      }
    })
    .sort((a, b) => b.score.budgetScore - a.score.budgetScore)
}

export function rankPackagesByBudget(
  rows: PackageBudgetRow[],
  options: RankBudgetOptions,
): RankedBudgetCandidate[] {
  return rows
    .map((row) => {
      const quality = row.hotelRating != null
        ? (row.hotelRating > 5 ? row.hotelRating * 10 : row.hotelRating * 20)
        : 65
      const score = computeBudgetScore({
        price: row.price,
        budgetCap: options.budgetCap,
        budgetMin: options.budgetMin,
        qualityHint: quality,
        durationMinutes: row.flightDurationMinutes ?? null,
        intent: options.intent,
        style: options.style,
      })
      return {
        id: row.id,
        kind: 'package' as const,
        title: row.title,
        price: row.price,
        currency: row.currency,
        score,
        reasons: reasonsFrom(score, row.price, options.budgetCap),
        payload: row.payload ?? {},
      }
    })
    .sort((a, b) => b.score.budgetScore - a.score.budgetScore)
}
