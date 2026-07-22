/**
 * Sprint 110 — TripCostCalculator
 * Total trip cost, taxes, budget utilization, and estimated savings.
 */

import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import type { TripCostBreakdown } from './types'

export interface TripCostInput {
  flight: RahhalFlightSearchOffer
  hotel: HotelOffer
  nights: number
  budget?: number | null
  currency?: string
  /** Average peer total used for relative savings when budget absent. */
  peerAverageTotal?: number | null
}

export function calculateTripCost(input: TripCostInput): TripCostBreakdown {
  const flightCost = input.flight.price != null && Number.isFinite(input.flight.price)
    ? Math.max(0, input.flight.price)
    : 0
  const hotelNightly = input.hotel.price != null && Number.isFinite(input.hotel.price)
    ? Math.max(0, input.hotel.price)
    : 0
  // HotelOffer.price is treated as stay total when nights already baked in by provider;
  // if taxes present, keep them separate. Stay cost = hotel price (offer total) for live hotels.
  const hotelCost = hotelNightly
  const taxes = input.hotel.taxes != null && Number.isFinite(input.hotel.taxes)
    ? Math.max(0, input.hotel.taxes)
    : 0
  const totalCost = round2(flightCost + hotelCost + taxes)
  const currency = (
    input.currency
    || input.flight.currency
    || input.hotel.currency
    || 'SAR'
  ).toUpperCase()

  let underBudget: boolean | null = null
  let budgetUtilization: number | null = null
  let estimatedSavings: number | null = null

  if (input.budget != null && Number.isFinite(input.budget) && input.budget > 0) {
    underBudget = totalCost <= input.budget
    budgetUtilization = round2(totalCost / input.budget)
    estimatedSavings = underBudget ? round2(input.budget - totalCost) : 0
  } else if (
    input.peerAverageTotal != null
    && Number.isFinite(input.peerAverageTotal)
    && input.peerAverageTotal > 0
  ) {
    const delta = input.peerAverageTotal - totalCost
    estimatedSavings = delta > 0 ? round2(delta) : 0
  }

  return {
    flightCost: round2(flightCost),
    hotelCost: round2(hotelCost),
    taxes: round2(taxes),
    totalCost,
    currency,
    estimatedSavings,
    underBudget,
    budgetUtilization,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export class TripCostCalculator {
  calculate(input: TripCostInput): TripCostBreakdown {
    return calculateTripCost(input)
  }
}

export function createTripCostCalculator(): TripCostCalculator {
  return new TripCostCalculator()
}
