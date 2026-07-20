/**
 * Sprint 41 — Supplier settlement (daily/weekly/monthly/manual/automatic/partial/FX).
 */

import type { CurrencyEngine } from './CurrencyEngine'
import type { SettlementBatch, SettlementCadence, SettlementStatus } from './types'

export class SettlementEngine {
  private readonly currency: CurrencyEngine
  private readonly batches = new Map<string, SettlementBatch>()

  constructor(currency: CurrencyEngine) {
    this.currency = currency
  }

  create(input: {
    supplierId: string
    amount: number
    currency: string
    settlementCurrency?: string
    cadence?: SettlementCadence
  }): SettlementBatch {
    const settlementCurrency = input.settlementCurrency ?? input.currency
    const fxRate = this.currency.rate(input.currency, settlementCurrency)
    const batch: SettlementBatch = {
      settlementId: `set_${Math.random().toString(36).slice(2, 10)}`,
      supplierId: input.supplierId,
      cadence: input.cadence ?? 'weekly',
      status: 'pending',
      amount: round2(input.amount),
      settledAmount: 0,
      currency: input.currency,
      settlementCurrency,
      fxRate,
      createdAt: new Date().toISOString(),
      settledAt: null,
    }
    this.batches.set(batch.settlementId, batch)
    return clone(batch)
  }

  settle(
    settlementId: string,
    amount?: number,
    mode: 'automatic' | 'manual' = 'automatic',
  ): SettlementBatch | null {
    const batch = this.batches.get(settlementId)
    if (!batch) return null
    const pay = round2(amount ?? batch.amount - batch.settledAmount)
    batch.settledAmount = round2(batch.settledAmount + pay)
    batch.cadence = mode === 'manual' ? 'manual' : batch.cadence === 'manual' ? 'automatic' : batch.cadence
    batch.status = statusFor(batch)
    if (batch.status === 'settled') batch.settledAt = new Date().toISOString()
    return clone(batch)
  }

  list(status?: SettlementStatus): SettlementBatch[] {
    return [...this.batches.values()]
      .filter((b) => (status ? b.status === status : true))
      .map(clone)
  }

  unpaidTotal(currency = 'SAR'): number {
    return round2(
      this.list('pending')
        .concat(this.list('partial'))
        .reduce((s, b) => {
          const remaining = b.amount - b.settledAmount
          return s + this.currency.convert(remaining, b.currency, currency)
        }, 0),
    )
  }

  get(settlementId: string): SettlementBatch | null {
    const batch = this.batches.get(settlementId)
    return batch ? clone(batch) : null
  }
}

export function createSettlementEngine(currency: CurrencyEngine): SettlementEngine {
  return new SettlementEngine(currency)
}

function statusFor(batch: SettlementBatch): SettlementStatus {
  if (batch.settledAmount <= 0) return 'pending'
  if (batch.settledAmount + 0.001 < batch.amount) return 'partial'
  return 'settled'
}

function clone(batch: SettlementBatch): SettlementBatch {
  return { ...batch }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
