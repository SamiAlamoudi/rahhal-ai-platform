/**
 * Sprint 41 — Invoice / receipt / credit-debit notes / statements.
 */

import type { FinanceDocument, InvoiceDocKind, RevenueBreakdown } from './types'

export class InvoiceService {
  private readonly docs: FinanceDocument[] = []

  issue(input: {
    kind: InvoiceDocKind
    partyId: string
    currency: string
    lines: Array<{ label: string; amount: number }>
  }): FinanceDocument {
    const total = round2(input.lines.reduce((s, l) => s + l.amount, 0))
    const doc: FinanceDocument = {
      documentId: `doc_${Math.random().toString(36).slice(2, 10)}`,
      kind: input.kind,
      partyId: input.partyId,
      currency: input.currency,
      total,
      lines: input.lines.map((l) => ({ ...l })),
      createdAt: new Date().toISOString(),
    }
    this.docs.push(doc)
    return { ...doc, lines: doc.lines.map((l) => ({ ...l })) }
  }

  fromRevenue(breakdown: RevenueBreakdown, partyId: string, kind: InvoiceDocKind = 'invoice'): FinanceDocument {
    return this.issue({
      kind,
      partyId,
      currency: breakdown.currency,
      lines: [
        { label: 'Base fare', amount: breakdown.baseFare },
        { label: 'Markup', amount: breakdown.rahhalMarkup },
        { label: 'Service fee', amount: breakdown.serviceFee },
        { label: 'Tax', amount: breakdown.tax },
        { label: 'Discounts', amount: -(breakdown.couponDiscount + breakdown.promoDiscount + breakdown.corporateDiscount) },
        { label: 'Wallet / rewards', amount: -(breakdown.walletUsed + breakdown.rewardRedemptionValue) },
      ],
    })
  }

  list(kind?: InvoiceDocKind): FinanceDocument[] {
    return this.docs
      .filter((d) => (kind ? d.kind === kind : true))
      .map((d) => ({ ...d, lines: d.lines.map((l) => ({ ...l })) }))
  }
}

export function createInvoiceService(): InvoiceService {
  return new InvoiceService()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
