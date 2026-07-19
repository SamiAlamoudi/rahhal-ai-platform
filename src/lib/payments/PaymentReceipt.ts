/**
 * Sprint 34 — Payment receipt generator.
 */

import type { PlatformPaymentSession } from './types'

export interface PaymentReceipt {
  receiptId: string
  sessionId: string
  intentId: string
  amount: number
  currency: string
  method: string | null
  providerId: string | null
  providerChargeId: string | null
  paidAt: string
  lines: Array<{ label: string; amount: number }>
  customerEmail: string | null
  customerName: string | null
}

export function generatePaymentReceipt(session: PlatformPaymentSession): PaymentReceipt {
  const receiptId = `RCPT-${session.sessionId.slice(-6).toUpperCase()}-${tail()}`
  const p = session.pricing
  return {
    receiptId,
    sessionId: session.sessionId,
    intentId: session.intent.intentId,
    amount: p.total,
    currency: p.currency,
    method: session.method,
    providerId: session.providerId,
    providerChargeId: session.providerChargeId,
    paidAt: session.paidAt ?? new Date().toISOString(),
    lines: [
      { label: 'Subtotal', amount: p.subtotal },
      ...(p.couponDiscount > 0
        ? [{ label: `Coupon (${p.couponCode ?? 'DISCOUNT'})`, amount: -p.couponDiscount }]
        : []),
      { label: `VAT (${Math.round(p.vatRate * 100)}%)`, amount: p.vatAmount },
      { label: 'Provider fees', amount: p.providerFees },
      { label: 'Service fees', amount: p.serviceFees },
      { label: 'Total paid', amount: p.total },
    ],
    customerEmail: session.customerEmail,
    customerName: session.customerName,
  }
}

function tail(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}
