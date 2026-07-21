/**
 * Sprint 79 — generate multiple independent SearchPlans from strategy context.
 */

import type { SearchPlan, SearchPlanObjective, ScoringWeights } from '../types'
import { emitDecisionEvent } from '../observability/events'
import type { DecisionEvent } from '../types'

export interface StrategyContext {
  purpose?: string | null
  priorityHints?: Partial<{
    price: number
    speed: number
    comfort: number
    convenience: number
    luxury: number
    family: number
    business: number
  }> | null
  budgetAmount?: number | null
  preferDirect?: boolean
  hotelBrandLocked?: boolean
  hasChildren?: boolean
  loyaltyPreferred?: boolean
}

function normalizeWeights(partial: Partial<ScoringWeights>): ScoringWeights {
  const base: ScoringWeights = {
    price: 0.12,
    duration: 0.1,
    layovers: 0.1,
    airport_quality: 0.06,
    departure_time: 0.06,
    arrival_time: 0.06,
    hotel_rating: 0.1,
    walking_distance: 0.08,
    review_quality: 0.08,
    refund_policy: 0.06,
    baggage: 0.06,
    overall_convenience: 0.12,
  }
  const merged = { ...base, ...partial }
  const sum = Object.values(merged).reduce((a, b) => a + b, 0) || 1
  const out = { ...merged }
  for (const key of Object.keys(out) as Array<keyof ScoringWeights>) {
    out[key] = Math.round((out[key]! / sum) * 1000) / 1000
  }
  return out
}

function plan(
  id: string,
  label: string,
  objective: SearchPlanObjective,
  weights: Partial<ScoringWeights>,
  constraints: SearchPlan['acceptableConstraints'],
  providerOrder: string[],
  fallbackStrategy: string,
  confidence: number,
): SearchPlan {
  return {
    id,
    label,
    objective,
    priorityWeights: normalizeWeights(weights),
    acceptableConstraints: constraints,
    providerOrder,
    fallbackStrategy,
    confidence,
  }
}

/**
 * Create Plans A–E (cheapest, balanced, fastest, premium, loyalty).
 */
export function createSearchPlans(
  strategy: StrategyContext = {},
  events?: DecisionEvent[],
): SearchPlan[] {
  const budget = strategy.budgetAmount ?? null
  const preferDirect = strategy.preferDirect === true
  const hasChildren = strategy.hasChildren === true
  const loyalty = strategy.loyaltyPreferred === true
    || strategy.purpose === 'business'
    || strategy.purpose === 'conference'

  const plans: SearchPlan[] = [
    plan(
      'plan-a-cheapest',
      'Plan A — Cheapest',
      'cheapest',
      { price: 0.34, duration: 0.08, layovers: 0.06, hotel_rating: 0.06, overall_convenience: 0.08 },
      {
        maxPrice: budget,
        maxDurationMinutes: null,
        maxStops: 2,
        maxLayoverMinutes: 480,
        preferDirect: false,
        minHotelStars: null,
        maxWalkMinutes: null,
        allowNearbyAirports: true,
        requireRefundable: false,
        loyaltyPreferred: false,
      },
      ['mock', 'amadeus', 'duffel', 'booking'],
      'widen layover + nearby airports',
      0.78,
    ),
    plan(
      'plan-b-balanced',
      'Plan B — Balanced',
      'balanced',
      { price: 0.16, duration: 0.14, layovers: 0.12, hotel_rating: 0.12, overall_convenience: 0.14 },
      {
        maxPrice: budget,
        maxDurationMinutes: 900,
        maxStops: 1,
        maxLayoverMinutes: 240,
        preferDirect,
        minHotelStars: 3,
        maxWalkMinutes: 35,
        allowNearbyAirports: false,
        requireRefundable: false,
        loyaltyPreferred: false,
      },
      ['amadeus', 'duffel', 'mock', 'booking'],
      'relax max stops to 2',
      0.86,
    ),
    plan(
      'plan-c-fastest',
      'Plan C — Fastest',
      'fastest',
      { duration: 0.28, layovers: 0.18, price: 0.1, overall_convenience: 0.14, arrival_time: 0.1 },
      {
        maxPrice: budget != null ? Math.round(budget * 1.25) : null,
        maxDurationMinutes: 600,
        maxStops: 0,
        maxLayoverMinutes: 90,
        preferDirect: true,
        minHotelStars: null,
        maxWalkMinutes: 25,
        allowNearbyAirports: false,
        requireRefundable: false,
        loyaltyPreferred: false,
      },
      ['duffel', 'amadeus', 'mock'],
      'allow 1 stop if no direct',
      0.82,
    ),
    plan(
      'plan-d-premium',
      'Plan D — Premium comfort',
      'premium_comfort',
      {
        hotel_rating: 0.18,
        review_quality: 0.12,
        overall_convenience: 0.14,
        walking_distance: 0.1,
        price: 0.08,
        duration: 0.1,
        baggage: 0.08,
        refund_policy: 0.08,
      },
      {
        maxPrice: budget != null ? Math.round(budget * 1.4) : null,
        maxDurationMinutes: null,
        maxStops: 1,
        maxLayoverMinutes: 180,
        preferDirect: true,
        minHotelStars: 4,
        maxWalkMinutes: 15,
        allowNearbyAirports: false,
        requireRefundable: true,
        loyaltyPreferred: false,
      },
      ['booking', 'amadeus', 'duffel', 'mock'],
      'drop refundable requirement',
      0.8,
    ),
    plan(
      'plan-e-loyalty',
      'Plan E — Loyalty friendly',
      'loyalty_friendly',
      {
        overall_convenience: 0.14,
        baggage: 0.1,
        refund_policy: 0.1,
        hotel_rating: 0.12,
        price: 0.12,
        duration: 0.1,
        layovers: 0.1,
      },
      {
        maxPrice: budget,
        maxDurationMinutes: null,
        maxStops: preferDirect ? 0 : 1,
        maxLayoverMinutes: 240,
        preferDirect,
        minHotelStars: hasChildren ? 4 : 3,
        maxWalkMinutes: hasChildren ? 20 : 30,
        allowNearbyAirports: false,
        requireRefundable: false,
        loyaltyPreferred: true,
      },
      ['amadeus', 'booking', 'duffel', 'mock'],
      'ignore loyalty match filter',
      loyalty ? 0.84 : 0.72,
    ),
  ]

  // Soft bias from travel strategy purpose
  if (strategy.purpose === 'family' || hasChildren) {
    plans[1]!.priorityWeights.hotel_rating += 0.02
    plans[3]!.acceptableConstraints.minHotelStars = Math.max(
      plans[3]!.acceptableConstraints.minHotelStars ?? 0,
      4,
    )
  }
  if (strategy.purpose === 'business' || strategy.purpose === 'conference') {
    plans[2]!.confidence = Math.min(0.95, plans[2]!.confidence + 0.06)
  }
  if (strategy.hotelBrandLocked) {
    plans[3]!.confidence = Math.min(0.95, plans[3]!.confidence + 0.05)
  }

  for (const p of plans) {
    emitDecisionEvent('search.plan.created', { planId: p.id, objective: p.objective }, events)
  }

  return plans
}

export type { SearchPlan }
