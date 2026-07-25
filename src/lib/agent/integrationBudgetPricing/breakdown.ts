/**
 * Integration Sprint 9 — full trip cost breakdown (incl. meals / insurance / taxes).
 * Uses existing offer prices when provided; otherwise estimates from envelope shares.
 */

import type { TripPlan, TripRequirements } from '../types'
import type { BudgetEnvelope, BudgetTier, CostBreakdown } from './types'

export interface OfferPriceHints {
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function pickFlightCost(hints?: OfferPriceHints, plan?: TripPlan | null): number | null {
  const offer = hints?.flightOffers?.[0]
  if (offer) {
    const p = num(offer.price) ?? num(offer.total) ?? num(offer.estimatedCost)
    if (p != null) return p
  }
  const f = plan?.flights[0]
  return f?.estimatedCost ?? null
}

function pickHotelCost(hints?: OfferPriceHints, plan?: TripPlan | null, nights = 4): number | null {
  const stay = hints?.hotelStays?.[0]
  if (stay) {
    const total = num(stay.total)
    if (total != null) return total
    const nightly = num(stay.nightly) ?? num(stay.estimatedNightly)
    if (nightly != null) return Math.round(nightly * nights)
  }
  const h = plan?.accommodations[0]
  if (h?.estimatedNightly != null) return Math.round(h.estimatedNightly * nights)
  return null
}

const TIER_SHARES: Record<BudgetTier, {
  flights: number
  hotels: number
  transportation: number
  meals: number
  activities: number
  insurance: number
  taxes: number
}> = {
  budget: {
    flights: 0.4, hotels: 0.32, transportation: 0.08, meals: 0.1, activities: 0.05, insurance: 0.02, taxes: 0.03,
  },
  balanced: {
    flights: 0.36, hotels: 0.34, transportation: 0.08, meals: 0.1, activities: 0.06, insurance: 0.03, taxes: 0.03,
  },
  premium: {
    flights: 0.33, hotels: 0.38, transportation: 0.07, meals: 0.1, activities: 0.06, insurance: 0.03, taxes: 0.03,
  },
  luxury: {
    flights: 0.3, hotels: 0.42, transportation: 0.06, meals: 0.1, activities: 0.06, insurance: 0.03, taxes: 0.03,
  },
  best_value: {
    flights: 0.38, hotels: 0.33, transportation: 0.08, meals: 0.09, activities: 0.06, insurance: 0.03, taxes: 0.03,
  },
}

export function buildCostBreakdown(input: {
  envelope: BudgetEnvelope
  tier: BudgetTier
  plan?: TripPlan | null
  requirements?: TripRequirements | null
  offers?: OfferPriceHints
}): CostBreakdown {
  const { envelope, tier } = input
  const currency = envelope.total.currency
  const usable = envelope.usable.amount
  const shares = TIER_SHARES[tier]
  const nights = envelope.nights

  let flights = pickFlightCost(input.offers, input.plan)
  let hotels = pickHotelCost(input.offers, input.plan, nights)

  if (flights == null) flights = Math.round(usable * shares.flights)
  if (hotels == null) hotels = Math.round(usable * shares.hotels)

  const transportation = Math.round(usable * shares.transportation)
  const meals = Math.round(usable * shares.meals)
  const activities = Math.round(usable * shares.activities)
  const insurance = Math.round(usable * shares.insurance)
  const taxes = Math.round(usable * shares.taxes)

  const estimatedTotal = flights + hotels + transportation + meals + activities + insurance + taxes
  const reserveHeld = envelope.emergencyReserve.amount
  const cap = envelope.total.amount
  const overBy = Math.max(0, estimatedTotal - cap)
  const underBy = Math.max(0, cap - estimatedTotal)

  return {
    currency,
    flights,
    hotels,
    transportation,
    meals,
    activities,
    insurance,
    taxes,
    estimatedTotal,
    reserveHeld,
    withinBudget: estimatedTotal <= cap,
    overBy,
    underBy,
  }
}
