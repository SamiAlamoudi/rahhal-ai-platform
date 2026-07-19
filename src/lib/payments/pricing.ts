/**
 * Sprint 34 — tax / fee / coupon pricing helpers.
 */

import type { SupportedCurrency, TaxBreakdown } from './types'

const COUPONS: Record<string, number> = {
  RAHHAL10: 0.1,
  RAHHAL15: 0.15,
  WELCOME50: 50, // flat amount marker via negative convention handled below
}

export function buildTaxBreakdown(input: {
  currency: SupportedCurrency
  subtotal: number
  vatRate: number
  providerFees?: number
  serviceFees?: number
  couponCode?: string | null
}): TaxBreakdown {
  const subtotal = round2(Math.max(0, input.subtotal))
  const providerFees = round2(Math.max(0, input.providerFees ?? defaultProviderFee(input.currency)))
  const serviceFees = round2(Math.max(0, input.serviceFees ?? defaultServiceFee(input.currency)))
  const couponCode = input.couponCode?.trim().toUpperCase() || null
  const couponDiscount = round2(resolveCouponDiscount(couponCode, subtotal))
  const taxable = Math.max(0, subtotal - couponDiscount)
  const vatAmount = round2(taxable * Math.max(0, input.vatRate))
  const total = round2(taxable + vatAmount + providerFees + serviceFees)

  return {
    currency: input.currency,
    subtotal,
    vatRate: input.vatRate,
    vatAmount,
    providerFees,
    serviceFees,
    couponDiscount,
    couponCode,
    total,
  }
}

function resolveCouponDiscount(code: string | null, subtotal: number): number {
  if (!code) return 0
  const value = COUPONS[code]
  if (value == null) return 0
  if (value >= 1) return Math.min(subtotal, value) // flat
  return subtotal * value
}

function defaultProviderFee(currency: SupportedCurrency): number {
  switch (currency) {
    case 'SAR':
      return 15
    case 'USD':
      return 4
    case 'EUR':
      return 3.5
    case 'GBP':
      return 3
  }
}

function defaultServiceFee(currency: SupportedCurrency): number {
  switch (currency) {
    case 'SAR':
      return 25
    case 'USD':
      return 7
    case 'EUR':
      return 6
    case 'GBP':
      return 5
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
