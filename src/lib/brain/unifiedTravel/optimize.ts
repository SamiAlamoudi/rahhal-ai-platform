/**
 * Sprint 31 — Optimize and rank matched flight+hotel travel plan options.
 */

import { estimateTripCost } from './cost'
import { buildUnifiedItinerary } from './itinerary'
import type {
  UnifiedFlightLeg,
  UnifiedHotelStay,
  UnifiedPlanCandidate,
  UnifiedPlanOptimizationFactor,
  UnifiedTravelPlanOption,
  UnifiedTravelPlannerContext,
} from './types'

export function pairFlightsAndHotels(
  flights: UnifiedFlightLeg[],
  hotels: UnifiedHotelStay[],
): UnifiedPlanCandidate[] {
  const flightPool = flights.length ? flights : [null]
  const hotelPool = hotels.length ? hotels : [null]
  const pairs: UnifiedPlanCandidate[] = []
  for (const flight of flightPool) {
    for (const hotel of hotelPool) {
      if (!flight && !hotel) continue
      pairs.push({ flight, hotel })
    }
  }
  // Cap combinatorial explosion for production safety.
  return pairs.slice(0, 24)
}

export function scoreAndRankPlans(input: {
  candidates: UnifiedPlanCandidate[]
  ctx: UnifiedTravelPlannerContext
  maxPlans?: number
}): UnifiedTravelPlanOption[] {
  const maxPlans = input.maxPlans ?? 5
  const scored = input.candidates.map((candidate, index) =>
    scoreCandidate(candidate, input.ctx, index),
  )
  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence)
  return scored.slice(0, maxPlans).map((plan, index) => ({
    ...plan,
    rank: index + 1,
  }))
}

function scoreCandidate(
  candidate: UnifiedPlanCandidate,
  ctx: UnifiedTravelPlannerContext,
  index: number,
): UnifiedTravelPlanOption {
  const cost = estimateTripCost({
    flight: candidate.flight,
    hotel: candidate.hotel,
    ctx,
  })
  const factors = computeFactors(candidate, ctx, cost.total)
  const score = weightedScore(factors)
  const matchedPreferences = collectMatchedPreferences(candidate, ctx)
  const loyaltyAligned = isLoyaltyAligned(candidate, ctx)
  const reasons = buildReasons(factors, matchedPreferences, loyaltyAligned, cost)
  const confidence = clamp01(
    score * 0.7
    + (matchedPreferences.length ? 0.1 : 0)
    + (loyaltyAligned ? 0.08 : 0)
    + (cost.withinBudget === false ? -0.15 : 0.05)
    + Math.max(0, 0.05 - index * 0.01),
  )

  const dest = ctx.destination || candidate.flight?.to || 'Trip'
  const title = [
    candidate.flight?.airline,
    dest,
    candidate.hotel?.name,
  ].filter(Boolean).join(' · ') || `${dest} plan`

  return {
    id: `plan_${candidate.flight?.id ?? 'nofly'}_${candidate.hotel?.id ?? 'nostay'}_${index}`,
    rank: 0,
    title,
    summary: buildSummary(candidate, cost, ctx),
    confidence: round4(confidence),
    score: round4(score),
    factors,
    reasons,
    flight: candidate.flight,
    hotel: candidate.hotel,
    cost,
    itinerary: buildUnifiedItinerary({
      ctx,
      flight: candidate.flight,
      hotel: candidate.hotel,
    }),
    matchedPreferences,
    loyaltyAligned,
  }
}

function computeFactors(
  candidate: UnifiedPlanCandidate,
  ctx: UnifiedTravelPlannerContext,
  totalCost: number,
): Record<UnifiedPlanOptimizationFactor, number> {
  const budget = ctx.budgetAmount
  const budgetScore =
    budget == null
      ? 0.7
      : clamp01(1 - Math.max(0, totalCost - budget) / Math.max(budget, 1))

  const durationHours = candidate.flight?.durationHours ?? 4
  const durationScore = clamp01(1 - (durationHours - 2) / 12)

  const prefHits = collectMatchedPreferences(candidate, ctx).length
  const prefTarget = Math.max(
    1,
    ctx.preferredAirlines.length + ctx.preferredHotels.length,
  )
  const preferencesScore = clamp01(0.45 + prefHits / prefTarget)

  const loyaltyScore = isLoyaltyAligned(candidate, ctx) ? 0.95 : 0.55

  const conversationScore = clamp01(
    0.5
    + (ctx.destination ? 0.15 : 0)
    + (ctx.origin ? 0.1 : 0)
    + (ctx.budgetAmount != null ? 0.1 : 0)
    + (ctx.cabinClass ? 0.05 : 0)
    + (ctx.activities.length ? 0.05 : 0),
  )

  const matchScore = candidate.flight && candidate.hotel
    ? flightHotelMatchScore(candidate.flight, candidate.hotel, ctx)
    : 0.4

  return {
    budget: round4(budgetScore),
    duration: round4(durationScore),
    preferences: round4(preferencesScore),
    loyalty: round4(loyaltyScore),
    conversation_context: round4(conversationScore),
    flight_hotel_match: round4(matchScore),
  }
}

function weightedScore(
  factors: Record<UnifiedPlanOptimizationFactor, number>,
): number {
  const weights: Record<UnifiedPlanOptimizationFactor, number> = {
    budget: 0.28,
    duration: 0.14,
    preferences: 0.2,
    loyalty: 0.1,
    conversation_context: 0.12,
    flight_hotel_match: 0.16,
  }
  let sum = 0
  for (const key of Object.keys(weights) as UnifiedPlanOptimizationFactor[]) {
    sum += factors[key] * weights[key]
  }
  return clamp01(sum)
}

function flightHotelMatchScore(
  flight: UnifiedFlightLeg,
  hotel: UnifiedHotelStay,
  ctx: UnifiedTravelPlannerContext,
): number {
  let score = 0.65
  // Same currency is a soft consistency signal.
  if (flight.currency === hotel.currency) score += 0.08
  // Prefer nonstop with higher-star hotels for premium cabins.
  if ((ctx.cabinClass === 'business' || ctx.cabinClass === 'first') && hotel.stars >= 4) {
    score += 0.1
  }
  if (flight.stops === 0) score += 0.07
  if (hotel.freeCancellation) score += 0.05
  if (hotel.stars >= 4 && flight.stops <= 1) score += 0.05
  return clamp01(score)
}

function collectMatchedPreferences(
  candidate: UnifiedPlanCandidate,
  ctx: UnifiedTravelPlannerContext,
): string[] {
  const matched: string[] = []
  const airline = candidate.flight?.airline.toLowerCase() ?? ''
  for (const pref of ctx.preferredAirlines) {
    if (airline.includes(pref.toLowerCase()) || pref.toLowerCase().includes(airline)) {
      matched.push(pref)
    }
  }
  const hotelName = candidate.hotel?.name.toLowerCase() ?? ''
  for (const pref of ctx.preferredHotels) {
    if (hotelName.includes(pref.toLowerCase())) matched.push(pref)
  }
  return unique(matched)
}

function isLoyaltyAligned(
  candidate: UnifiedPlanCandidate,
  ctx: UnifiedTravelPlannerContext,
): boolean {
  if (!ctx.loyaltyPrograms.length || !candidate.flight) return false
  const airline = candidate.flight.airline.toLowerCase()
  return ctx.loyaltyPrograms.some((program) => {
    const p = program.toLowerCase()
    if (p.includes('alfursan') || p.includes('saudia')) return airline.includes('saudia')
    if (p.includes('skywards') || p.includes('emirates')) return airline.includes('emirates')
    if (p.includes('etihad')) return airline.includes('etihad')
    if (p.includes('privilege') || p.includes('qatar')) return airline.includes('qatar')
    return airline.includes(p)
  })
}

function buildReasons(
  factors: Record<UnifiedPlanOptimizationFactor, number>,
  matchedPreferences: string[],
  loyaltyAligned: boolean,
  cost: { total: number; currency: string; withinBudget: boolean | null },
): string[] {
  const reasons: string[] = []
  if (cost.withinBudget === true) {
    reasons.push(`Fits budget at ${cost.total} ${cost.currency}`)
  } else if (cost.withinBudget === false) {
    reasons.push(`Above budget (${cost.total} ${cost.currency})`)
  }
  if (matchedPreferences.length) {
    reasons.push(`Matches preferences: ${matchedPreferences.join(', ')}`)
  }
  if (loyaltyAligned) reasons.push('Aligned with loyalty program')
  if (factors.flight_hotel_match >= 0.75) {
    reasons.push('Strong flight–hotel pairing')
  }
  if (factors.duration >= 0.7) reasons.push('Efficient travel duration')
  return reasons
}

function buildSummary(
  candidate: UnifiedPlanCandidate,
  cost: { total: number; currency: string; nights: number },
  ctx: UnifiedTravelPlannerContext,
): string {
  const parts = [
    ctx.destination ? `${ctx.destination} trip` : 'Travel plan',
    candidate.flight ? `${candidate.flight.airline} flight` : null,
    candidate.hotel ? `${candidate.hotel.name} (${cost.nights}n)` : null,
    `${cost.total} ${cost.currency} est.`,
  ]
  return parts.filter(Boolean).join(' · ')
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
