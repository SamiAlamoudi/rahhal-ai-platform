/**
 * Sprint 75 — allocate budget across trip categories.
 */

import type { BudgetAllocation, BudgetIntent } from './types'

export interface AllocateBudgetInput {
  total: number
  currency: string
  intent?: BudgetIntent
  style?: 'luxury' | 'midrange' | 'budget' | null
  nights?: number
  flightsOnly?: boolean
  hotelsOnly?: boolean
}

/** Default shares — flights / hotels dominate; activities reserved for future. */
const SHARES: Record<'budget' | 'midrange' | 'luxury', Record<keyof Omit<BudgetAllocation, 'currency' | 'total'>, number>> = {
  budget: { flights: 0.42, hotels: 0.38, transportation: 0.12, activities: 0.08 },
  midrange: { flights: 0.4, hotels: 0.4, transportation: 0.12, activities: 0.08 },
  luxury: { flights: 0.35, hotels: 0.45, transportation: 0.1, activities: 0.1 },
}

export function allocateBudget(input: AllocateBudgetInput): BudgetAllocation {
  const total = Math.max(0, input.total)
  const style = input.style ?? (
    input.intent === 'cheapest' || input.intent === 'economy'
      ? 'budget'
      : input.intent === 'luxury' || input.intent === 'premium'
        ? 'luxury'
        : 'midrange'
  )
  let shares = { ...SHARES[style] }

  if (input.flightsOnly) {
    shares = { flights: 0.92, hotels: 0, transportation: 0.05, activities: 0.03 }
  } else if (input.hotelsOnly) {
    shares = { flights: 0, hotels: 0.9, transportation: 0.05, activities: 0.05 }
  } else if (input.intent === 'cheapest') {
    shares = { flights: 0.45, hotels: 0.4, transportation: 0.1, activities: 0.05 }
  }

  const flights = Math.round(total * shares.flights)
  const hotels = Math.round(total * shares.hotels)
  const transportation = Math.round(total * shares.transportation)
  const activities = Math.max(0, total - flights - hotels - transportation)

  return {
    flights,
    hotels,
    transportation,
    activities,
    currency: input.currency,
    total,
  }
}

/** Per-night hotel ceiling from allocated hotel budget. */
export function hotelNightlyCap(allocation: BudgetAllocation, nights: number): number {
  const n = Math.max(1, nights)
  return Math.max(50, Math.round(allocation.hotels / n))
}
