/**
 * Sprint 41 — Accounting views over the double-entry ledger.
 */

import type { LedgerEngine } from './LedgerEngine'
import type { RevenueBreakdown } from './types'

export class AccountingEngine {
  private readonly ledger: LedgerEngine
  private refundLosses = 0

  constructor(ledger: LedgerEngine) {
    this.ledger = ledger
  }

  postRevenue(breakdown: RevenueBreakdown): void {
    const c = breakdown.currency
    const ref = breakdown.bookingId
    this.ledger.postPair({
      debitAccount: 'cash',
      creditAccount: 'revenue',
      amount: breakdown.rahhalRevenue,
      currency: c,
      ref,
      note: 'Recognize Rahhal revenue',
    })
    if (breakdown.tax > 0) {
      this.ledger.postPair({
        debitAccount: 'cash',
        creditAccount: 'tax',
        amount: breakdown.tax,
        currency: c,
        ref,
        note: 'Collect tax',
      })
    }
    if (breakdown.supplierCommission > 0) {
      this.ledger.postPair({
        debitAccount: 'commission',
        creditAccount: 'payable',
        amount: breakdown.supplierCommission,
        currency: c,
        ref,
        note: 'Supplier commission payable',
      })
    }
    if (breakdown.customerTotal > breakdown.partialPayment) {
      this.ledger.postPair({
        debitAccount: 'receivable',
        creditAccount: 'revenue',
        amount: round2(breakdown.customerTotal - breakdown.partialPayment),
        currency: c,
        ref,
        note: 'Outstanding customer receivable',
      })
    }
  }

  recordRefundLoss(amount: number, currency: string, ref: string): void {
    this.refundLosses = round2(this.refundLosses + amount)
    this.ledger.postPair({
      debitAccount: 'refund_loss',
      creditAccount: 'cash',
      amount,
      currency,
      ref,
      note: 'Refund loss',
    })
  }

  snapshot(currency = 'SAR') {
    return {
      revenue: Math.max(0, -this.ledger.balance('revenue', currency)),
      expenses: Math.max(0, this.ledger.balance('expense', currency)),
      taxes: Math.max(0, -this.ledger.balance('tax', currency)),
      payables: this.ledger.outstanding('payable', currency),
      receivables: this.ledger.outstanding('receivable', currency),
      commission: Math.max(0, this.ledger.balance('commission', currency)),
      refundLosses: this.refundLosses,
      cash: this.ledger.balance('cash', currency),
    }
  }
}

export function createAccountingEngine(ledger: LedgerEngine): AccountingEngine {
  return new AccountingEngine(ledger)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
