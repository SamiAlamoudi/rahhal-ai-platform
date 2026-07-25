/**
 * Integration Sprint 9 — BudgetEngine (envelope: total / per traveler / per day / reserve).
 */

import type { TripRequirements } from '../types'
import { normalizeCurrency } from './currency'
import type { BudgetEnvelope, CurrencyAmount } from './types'

export class BudgetEngine {
  buildEnvelope(input: {
    total: number
    currency?: string | null
    travelers?: number | null
    nights?: number | null
    /** Reserve share of total (default 8%). */
    reserveRatio?: number
  }): BudgetEnvelope {
    const currency = normalizeCurrency(input.currency)
    const travelers = Math.max(1, input.travelers ?? 1)
    const nights = Math.max(1, input.nights ?? 4)
    const totalAmount = Math.max(0, input.total)
    const reserveRatio = Math.min(0.2, Math.max(0.05, input.reserveRatio ?? 0.08))
    const reserve = Math.round(totalAmount * reserveRatio)
    const usable = Math.max(0, totalAmount - reserve)

    const money = (amount: number): CurrencyAmount => ({ amount, currency })

    return {
      total: money(totalAmount),
      perTraveler: money(Math.round(usable / travelers)),
      perDay: money(Math.round(usable / nights)),
      emergencyReserve: money(reserve),
      usable: money(usable),
      travelers,
      nights,
    }
  }

  fromRequirements(requirements: TripRequirements, nightsFallback = 4): BudgetEnvelope | null {
    const total = requirements.budgetAmount
    if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return null
    const nights = Math.max(
      1,
      requirements.durationDays
        ? Math.max(1, requirements.durationDays - 1)
        : nightsFallback,
    )
    return this.buildEnvelope({
      total,
      currency: requirements.budgetCurrency,
      travelers: requirements.travelers,
      nights,
      reserveRatio: requirements.budgetStyle === 'luxury' ? 0.1 : 0.08,
    })
  }
}

export function createBudgetEngine(): BudgetEngine {
  return new BudgetEngine()
}
