/**
 * Sprint 24 — ranking & scoring over normalized SearchOptions.
 */

import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'
import type {
  RankingFactorScores,
  SearchOption,
  SearchResult,
} from './types'

export type RankingContext = {
  tripPlan?: EngineTripPlan | null
  budgetAmount?: number | null
  preferredAirlines?: string[]
  preferredHotels?: string[]
  activities?: string[]
  notes?: string | null
}

/**
 * Score and rank options using:
 * price, duration, stops, hotel rating, location, budget fit,
 * preference match, trip goals.
 */
export function rankAndScoreOptions(
  options: SearchOption[],
  ctx: RankingContext = {},
): SearchResult[] {
  const scored = options.map((option) => scoreOne(option, ctx))
  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence)
  return scored
}

function scoreOne(option: SearchOption, ctx: RankingContext): SearchResult {
  const factors = emptyFactors()
  const reasons: string[] = []
  const rejectReasons: string[] = []
  let rejected = false

  const budget = ctx.budgetAmount ?? ctx.tripPlan?.budget.amount ?? null
  const airlines = ctx.preferredAirlines ?? ctx.tripPlan?.airlinePreferences ?? []
  const hotels = ctx.preferredHotels ?? ctx.tripPlan?.hotelPreferences ?? []
  const activities = ctx.activities ?? ctx.tripPlan?.activities ?? []
  const notes = ctx.notes ?? ctx.tripPlan?.notes ?? null
  const preferCheap = Boolean(notes?.includes('prefer_cheaper_flight'))

  switch (option.kind) {
    case 'flight': {
      factors.price = priceScore(option.price, budget, preferCheap)
      factors.duration = clamp01(1 - (option.durationHours - 1.5) / 12)
      factors.stops = option.stops === 0 ? 1 : option.stops === 1 ? 0.6 : 0.3
      factors.preferenceMatch = airlines.length
        ? airlines.some((a) => option.airline.toLowerCase().includes(a.toLowerCase()))
          ? 1
          : 0.35
        : 0.55
      factors.budgetFit = budgetFit(option.price, budget)
      factors.tripGoals = 0.7
      factors.location = 0.5
      factors.hotelRating = 0.5
      if (preferCheap && option.price > (budget ?? option.price) * 0.9) {
        reasons.push('higher_than_preferred_budget_band')
      }
      if (option.stops === 0) reasons.push('nonstop')
      if (factors.preferenceMatch >= 1) reasons.push('airline_preference_match')
      break
    }
    case 'hotel': {
      factors.hotelRating = clamp01(option.stars / 5)
      factors.price = priceScore(option.nightly * 4, budget, false)
      factors.location = /downtown|center|old town|marina/i.test(option.area) ? 0.9 : 0.55
      factors.preferenceMatch = hotels.length
        ? hotels.some((h) =>
            option.name.toLowerCase().includes(h.toLowerCase()) ||
            h.toLowerCase().includes('resort') && /resort/i.test(option.name) ||
            h.toLowerCase().includes('boutique') && /boutique/i.test(option.name) ||
            h.toLowerCase().includes('upgraded') && option.stars >= 4,
          )
          ? 1
          : 0.4
        : 0.55
      factors.budgetFit = budgetFit(option.nightly * 4, budget)
      factors.tripGoals = 0.65
      factors.duration = 0.5
      factors.stops = 0.5
      if (option.stars >= 4) reasons.push('high_rating')
      if (factors.location >= 0.85) reasons.push('strong_location')
      if (factors.preferenceMatch >= 1) reasons.push('hotel_preference_match')
      break
    }
    case 'transport': {
      factors.price = priceScore(option.price, budget ? budget * 0.05 : null, true)
      factors.duration = option.mode === 'transfer' ? 0.85 : 0.7
      factors.location = 0.75
      factors.budgetFit = 0.8
      factors.preferenceMatch = 0.5
      factors.tripGoals = 0.6
      factors.stops = 0.5
      factors.hotelRating = 0.5
      reasons.push(`mode:${option.mode}`)
      break
    }
    case 'activity': {
      factors.price = priceScore(option.price, budget ? budget * 0.1 : null, false)
      factors.preferenceMatch = activities.length
        ? activities.some((a) => option.category.toLowerCase().includes(a.toLowerCase()))
          ? 1
          : 0.4
        : 0.55
      factors.tripGoals = factors.preferenceMatch
      factors.location = 0.6
      factors.budgetFit = budgetFit(option.price, budget ? budget * 0.1 : null)
      factors.duration = 0.55
      factors.stops = 0.5
      factors.hotelRating = 0.5
      if (factors.preferenceMatch >= 1) reasons.push('activity_interest_match')
      break
    }
    case 'package': {
      factors.price = priceScore(option.price, budget, false)
      factors.budgetFit = budgetFit(option.price, budget)
      factors.tripGoals = option.includes.length >= 2 ? 0.9 : 0.6
      factors.preferenceMatch = 0.7
      factors.duration = 0.6
      factors.stops = 0.5
      factors.hotelRating = 0.55
      factors.location = 0.6
      reasons.push('bundled_value')
      if (budget != null && option.price > budget * 1.35) {
        rejected = true
        rejectReasons.push('over_budget')
      }
      break
    }
  }

  const score = weightedScore(factors)
  const confidence = clamp01(0.45 + score * 0.5)

  if (budget != null && priceOf(option) > budget * 1.5 && option.kind !== 'hotel') {
    rejected = true
    rejectReasons.push('far_over_budget')
  }
  if (option.kind === 'hotel' && budget != null && option.nightly * 4 > budget * 1.5) {
    rejected = true
    rejectReasons.push('hotel_over_budget')
  }

  return {
    id: `sr_${option.kind}_${option.id}`,
    option,
    score: round4(score),
    confidence: round4(confidence),
    factors,
    reasons,
    rejected,
    rejectReasons,
  }
}

function emptyFactors(): RankingFactorScores {
  return {
    price: 0.5,
    duration: 0.5,
    stops: 0.5,
    hotelRating: 0.5,
    location: 0.5,
    budgetFit: 0.5,
    preferenceMatch: 0.5,
    tripGoals: 0.5,
  }
}

function weightedScore(f: RankingFactorScores): number {
  return (
    f.price * 0.18 +
    f.duration * 0.1 +
    f.stops * 0.12 +
    f.hotelRating * 0.1 +
    f.location * 0.1 +
    f.budgetFit * 0.16 +
    f.preferenceMatch * 0.14 +
    f.tripGoals * 0.1
  )
}

function priceScore(price: number, budget: number | null, preferCheap: boolean): number {
  if (budget == null || budget <= 0) {
    return preferCheap ? clamp01(1 - price / 5000) : 0.55
  }
  const ratio = price / budget
  if (ratio <= 0.5) return 1
  if (ratio <= 0.85) return 0.85
  if (ratio <= 1) return 0.7
  if (ratio <= 1.2) return 0.4
  return 0.15
}

function budgetFit(price: number, budget: number | null): number {
  if (budget == null || budget <= 0) return 0.55
  const ratio = price / budget
  if (ratio <= 1) return clamp01(1 - ratio * 0.2)
  return clamp01(1.2 - ratio)
}

function priceOf(option: SearchOption): number {
  return option.kind === 'hotel' ? option.nightly : option.price
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
