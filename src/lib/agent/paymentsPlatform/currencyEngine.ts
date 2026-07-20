/**
 * Currency Engine — Sprint 58.
 * Normalize currency, FX, taxes, fees, commissions, rounding.
 */

import type { MoneyBreakdown } from './types'

const FX: Record<string, number> = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.1,
  GBP: 4.75,
  AED: 1.02,
}

export type CurrencyNormalizeInput = {
  amount: number
  currency: string
  targetCurrency?: string
  taxRate?: number
  feeRate?: number
  commissionRate?: number
}

export function normalizeMoney(input: CurrencyNormalizeInput): MoneyBreakdown {
  const currency = (input.currency || 'SAR').toUpperCase()
  const target = (input.targetCurrency || 'SAR').toUpperCase()
  const fromRate = FX[currency] ?? 1
  const toRate = FX[target] ?? 1
  const exchangeRate = fromRate / toRate
  const normalizedAmount = round2(input.amount * exchangeRate)
  const taxRate = input.taxRate ?? 0.15
  const feeRate = input.feeRate ?? 0.02
  const commissionRate = input.commissionRate ?? 0.03
  const taxes = round2(normalizedAmount * taxRate)
  const fees = round2(normalizedAmount * feeRate)
  const providerCommission = round2(normalizedAmount * commissionRate)
  const roundedAmount = round2(normalizedAmount + taxes + fees)

  return {
    amount: round2(input.amount),
    currency,
    normalizedAmount,
    normalizedCurrency: target,
    exchangeRate: round4(exchangeRate),
    taxes,
    fees,
    providerCommission,
    roundedAmount,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
