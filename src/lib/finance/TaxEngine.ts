/**
 * Sprint 41 — VAT / GST / Sales Tax adapters (sandbox).
 */

import type { TaxKind } from './types'

export interface TaxAdapter {
  readonly kind: TaxKind
  readonly country: string
  ratePercent: number
  calculate(amount: number): number
}

function adapter(kind: TaxKind, country: string, ratePercent: number): TaxAdapter {
  return {
    kind,
    country: country.toUpperCase(),
    ratePercent,
    calculate(amount: number) {
      return round2(amount * (ratePercent / 100))
    },
  }
}

export class TaxEngine {
  private readonly adapters: TaxAdapter[] = [
    adapter('vat', 'SA', 15),
    adapter('vat', 'AE', 5),
    adapter('vat', 'GB', 20),
    adapter('gst', 'IN', 18),
    adapter('sales_tax', 'US', 8),
    adapter('custom', 'XX', 0),
  ]

  listAdapters(): TaxAdapter[] {
    return this.adapters.map((a) => ({ ...a }))
  }

  resolve(country?: string | null): TaxAdapter {
    const code = (country ?? 'SA').toUpperCase()
    return this.adapters.find((a) => a.country === code) ?? this.adapters[0]
  }

  calculate(amount: number, country?: string | null): { tax: number; kind: TaxKind; ratePercent: number } {
    const a = this.resolve(country)
    return { tax: a.calculate(amount), kind: a.kind, ratePercent: a.ratePercent }
  }

  registerCustom(country: string, ratePercent: number): TaxAdapter {
    const next = adapter('custom', country, ratePercent)
    this.adapters.push(next)
    return { ...next }
  }
}

export function createTaxEngine(): TaxEngine {
  return new TaxEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
