/**
 * Sprint 41 — Double-entry ledger (debit/credit).
 */

import type { LedgerAccountKind, LedgerEntry } from './types'

export class LedgerEngine {
  private readonly entries: LedgerEntry[] = []

  post(input: {
    account: LedgerAccountKind
    debit?: number
    credit?: number
    currency: string
    ref: string
    note: string
  }): LedgerEntry {
    const entry: LedgerEntry = {
      entryId: `led_${Math.random().toString(36).slice(2, 10)}`,
      account: input.account,
      debit: round2(input.debit ?? 0),
      credit: round2(input.credit ?? 0),
      currency: input.currency,
      ref: input.ref,
      note: input.note,
      at: new Date().toISOString(),
    }
    this.entries.push(entry)
    return { ...entry }
  }

  /** Balanced double-entry pair helper. */
  postPair(input: {
    debitAccount: LedgerAccountKind
    creditAccount: LedgerAccountKind
    amount: number
    currency: string
    ref: string
    note: string
  }): [LedgerEntry, LedgerEntry] {
    const debit = this.post({
      account: input.debitAccount,
      debit: input.amount,
      currency: input.currency,
      ref: input.ref,
      note: input.note,
    })
    const credit = this.post({
      account: input.creditAccount,
      credit: input.amount,
      currency: input.currency,
      ref: input.ref,
      note: input.note,
    })
    return [debit, credit]
  }

  balance(account: LedgerAccountKind, currency = 'SAR'): number {
    return round2(
      this.entries
        .filter((e) => e.account === account && e.currency === currency)
        .reduce((s, e) => s + e.debit - e.credit, 0),
    )
  }

  outstanding(kind: 'payable' | 'receivable', currency = 'SAR'): number {
    const bal = this.balance(kind, currency)
    return kind === 'payable' ? Math.max(0, -bal) : Math.max(0, bal)
  }

  list(account?: LedgerAccountKind): LedgerEntry[] {
    return this.entries
      .filter((e) => (account ? e.account === account : true))
      .map((e) => ({ ...e }))
  }
}

export function createLedgerEngine(): LedgerEngine {
  return new LedgerEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
