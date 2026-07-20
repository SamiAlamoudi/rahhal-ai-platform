/**
 * Document Center — Sprint 58.
 */

import type { DocumentKind, DocumentRecord, UnifiedTicket } from './types'

export class DocumentCenter {
  private readonly docs = new Map<string, DocumentRecord>()

  store(input: {
    paymentSessionId: string
    kind: DocumentKind
    label: string
    relatedTicketId?: string | null
    meta?: Record<string, unknown>
    now?: () => number
  }): DocumentRecord {
    const now = input.now ?? (() => Date.now())
    const id = `doc_${Math.random().toString(36).slice(2, 10)}`
    const body = [
      `Rahhal — ${input.label}`,
      `Session: ${input.paymentSessionId}`,
      `Type: ${input.kind}`,
      `Issued: ${new Date(now()).toISOString()}`,
      input.meta ? `Meta: ${JSON.stringify(input.meta)}` : '',
    ].filter(Boolean).join('\n')
    const record: DocumentRecord = {
      id,
      paymentSessionId: input.paymentSessionId,
      kind: input.kind,
      label: input.label,
      relatedTicketId: input.relatedTicketId ?? null,
      downloadUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`,
      createdAt: new Date(now()).toISOString(),
      meta: input.meta,
    }
    this.docs.set(id, record)
    return record
  }

  storeTicketBundle(input: {
    paymentSessionId: string
    tickets: UnifiedTicket[]
    invoiceAmount: number
    currency: string
    now?: () => number
  }): DocumentRecord[] {
    const created: DocumentRecord[] = []
    for (const ticket of input.tickets) {
      if (ticket.pnr) {
        created.push(this.store({
          paymentSessionId: input.paymentSessionId,
          kind: 'pnr',
          label: `PNR ${ticket.pnr}`,
          relatedTicketId: ticket.id,
          meta: { pnr: ticket.pnr },
          now: input.now,
        }))
      }
      const kind: DocumentKind =
        ticket.kind === 'flight' ? 'eticket' : 'voucher'
      created.push(this.store({
        paymentSessionId: input.paymentSessionId,
        kind,
        label: `${ticket.kind} ${ticket.confirmation ?? ticket.id}`,
        relatedTicketId: ticket.id,
        now: input.now,
      }))
      ticket.documentIds.push(...created.slice(-2).map((d) => d.id))
    }
    created.push(this.store({
      paymentSessionId: input.paymentSessionId,
      kind: 'invoice',
      label: `Invoice ${input.invoiceAmount} ${input.currency}`,
      meta: { amount: input.invoiceAmount, currency: input.currency },
      now: input.now,
    }))
    created.push(this.store({
      paymentSessionId: input.paymentSessionId,
      kind: 'receipt',
      label: 'Payment receipt',
      now: input.now,
    }))
    created.push(this.store({
      paymentSessionId: input.paymentSessionId,
      kind: 'confirmation_pdf',
      label: 'Booking confirmation PDF',
      now: input.now,
    }))
    return created
  }

  storeRefundDocument(input: {
    paymentSessionId: string
    refundId: string
    amount: number
    currency: string
    now?: () => number
  }): DocumentRecord {
    return this.store({
      paymentSessionId: input.paymentSessionId,
      kind: 'refund',
      label: `Refund ${input.amount} ${input.currency}`,
      meta: { refundId: input.refundId },
      now: input.now,
    })
  }

  list(paymentSessionId?: string): DocumentRecord[] {
    const all = [...this.docs.values()]
    if (!paymentSessionId) return all
    return all.filter((d) => d.paymentSessionId === paymentSessionId)
  }

  get(id: string): DocumentRecord | undefined {
    return this.docs.get(id)
  }

  clear(): void {
    this.docs.clear()
  }
}
