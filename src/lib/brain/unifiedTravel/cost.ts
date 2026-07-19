/**
 * Sprint 31 — Trip cost estimation for matched flight + hotel plans.
 */

import type {
  UnifiedFlightLeg,
  UnifiedHotelStay,
  UnifiedTravelPlannerContext,
  UnifiedTripCostEstimate,
} from './types'

export function estimateTripCost(input: {
  flight: UnifiedFlightLeg | null
  hotel: UnifiedHotelStay | null
  ctx: UnifiedTravelPlannerContext
  activityBudgetPerDay?: number
  transportBudget?: number
}): UnifiedTripCostEstimate {
  const currency =
    input.flight?.currency
    || input.hotel?.currency
    || input.ctx.currency
    || 'SAR'
  const nights = Math.max(1, input.hotel?.nights ?? input.ctx.nights)
  const travelers = Math.max(1, input.ctx.adults + input.ctx.children)

  const flights = roundMoney((input.flight?.price ?? 0) * travelers)
  const hotels = roundMoney(
    input.hotel?.stayTotal
    ?? (input.hotel ? input.hotel.nightly * nights : 0),
  )
  const activities = roundMoney(
    (input.activityBudgetPerDay ?? (input.ctx.activities.length ? 150 : 80)) * nights,
  )
  const transport = roundMoney(input.transportBudget ?? 120)
  const subtotal = flights + hotels + activities + transport
  const taxesAndFees = roundMoney(subtotal * 0.08)
  const total = roundMoney(subtotal + taxesAndFees)
  const budgetAmount = input.ctx.budgetAmount
  const withinBudget = budgetAmount == null ? null : total <= budgetAmount
  const remainingBudget =
    budgetAmount == null ? null : roundMoney(budgetAmount - total)

  return {
    currency,
    flights,
    hotels,
    activities,
    transport,
    taxesAndFees,
    total,
    nights,
    withinBudget,
    budgetAmount,
    remainingBudget,
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}
