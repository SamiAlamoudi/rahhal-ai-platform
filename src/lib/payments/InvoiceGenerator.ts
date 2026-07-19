/**
 * Sprint 34 — Booking invoice generator (platform layer).
 * Complements src/lib/payment/invoiceGenerator for RahhalOrder carts;
 * this builds invoices from platform payment sessions after execution.
 */

import type { PlatformPaymentSession } from './types'

export interface BookingInvoiceLine {
  label: string
  amount: number
  type: 'item' | 'tax' | 'fee' | 'discount' | 'total'
}

export interface BookingInvoice {
  invoiceId: string
  invoiceNumber: string
  sessionId: string
  bookingReference: string | null
  tripReference: string | null
  paymentReference: string | null
  lines: BookingInvoiceLine[]
  subtotal: number
  taxes: number
  fees: number
  discount: number
  total: number
  currency: string
  issuedAt: string
  status: 'issued' | 'paid' | 'refunded'
}

export class InvoiceGenerator {
  generate(session: PlatformPaymentSession): BookingInvoice {
    const p = session.pricing
    const invoiceId = `inv_${Math.random().toString(36).slice(2, 10)}`
    const invoiceNumber = `INV-${(session.bookingRefs?.bookingReference ?? session.sessionId)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-8)
      .toUpperCase()}`

    const lines: BookingInvoiceLine[] = [
      { label: 'Travel itinerary', amount: p.subtotal, type: 'item' },
    ]
    if (p.couponDiscount > 0) {
      lines.push({
        label: `Coupon (${p.couponCode ?? 'DISCOUNT'})`,
        amount: -p.couponDiscount,
        type: 'discount',
      })
    }
    lines.push({
      label: `VAT (${Math.round(p.vatRate * 100)}%)`,
      amount: p.vatAmount,
      type: 'tax',
    })
    if (p.providerFees > 0) {
      lines.push({ label: 'Provider fees', amount: p.providerFees, type: 'fee' })
    }
    if (p.serviceFees > 0) {
      lines.push({ label: 'Service fees', amount: p.serviceFees, type: 'fee' })
    }
    lines.push({ label: 'Total', amount: p.total, type: 'total' })

    const refunded = session.state === 'REFUNDED' || session.state === 'PARTIALLY_REFUNDED'

    return {
      invoiceId,
      invoiceNumber,
      sessionId: session.sessionId,
      bookingReference: session.bookingRefs?.bookingReference ?? null,
      tripReference: session.bookingRefs?.tripReference ?? null,
      paymentReference: session.bookingRefs?.paymentReference ?? null,
      lines,
      subtotal: p.subtotal,
      taxes: p.vatAmount,
      fees: p.providerFees + p.serviceFees,
      discount: p.couponDiscount,
      total: p.total,
      currency: p.currency,
      issuedAt: new Date().toISOString(),
      status: refunded ? 'refunded' : 'paid',
    }
  }
}

export function createInvoiceGenerator(): InvoiceGenerator {
  return new InvoiceGenerator()
}
