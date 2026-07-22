/**
 * Sprint 93 — trip cost aggregation (no duplicated pricing engines).
 */

import type {
  TripActivity,
  TripFlight,
  TripHotel,
  TripInsurance,
  TripPricingSummary,
  TripTransfer,
  TripVisa,
} from './types'

const TAX_RATE = 0.05
const FEE_RATE = 0.02

export function calculateTripCosts(input: {
  flights: TripFlight[]
  hotel: TripHotel | null
  transfers: TripTransfer[]
  activities: TripActivity[]
  insurance: TripInsurance | null
  visa: TripVisa | null
  currency: string
  budgetCap?: number | null
}): TripPricingSummary {
  const flightCost = sum(input.flights.map((f) => f.price))
  const hotelCost = input.hotel?.price ?? 0
  const transferCost = sum(input.transfers.map((t) => t.price))
  const activityCost = sum(input.activities.map((a) => a.price))
  const insuranceCost = input.insurance?.price ?? 0
  const visaCost = input.visa?.estimatedFee ?? 0

  const subtotal = round(
    flightCost + hotelCost + transferCost + activityCost + insuranceCost + visaCost,
  )
  const estimatedTaxes = round(subtotal * TAX_RATE)
  const estimatedFees = round(subtotal * FEE_RATE)
  const total = round(subtotal + estimatedTaxes + estimatedFees)
  const budgetCap = input.budgetCap ?? null
  const budgetDelta = budgetCap != null ? round(total - budgetCap) : null

  return {
    flightCost: round(flightCost),
    hotelCost: round(hotelCost),
    transferCost: round(transferCost),
    activityCost: round(activityCost),
    insuranceCost: round(insuranceCost),
    visaCost: round(visaCost),
    estimatedTaxes,
    estimatedFees,
    subtotal,
    total,
    currency: input.currency,
    budgetCap,
    budgetDelta,
  }
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
