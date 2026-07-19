/**
 * Sprint 34 — PaymentResult aggregate.
 */

import type { PaymentEvent } from './PaymentEvents'
import type { PaymentReceipt } from './PaymentReceipt'
import type { BookingInvoice } from './InvoiceGenerator'
import type { PlatformPaymentSession, ProviderChargeResult } from './types'

export interface PaymentResult {
  success: boolean
  session: PlatformPaymentSession
  charge: ProviderChargeResult | null
  receipt: PaymentReceipt | null
  invoice: BookingInvoice | null
  events: PaymentEvent[]
  message: string
}

export function buildPaymentResult(input: {
  success: boolean
  session: PlatformPaymentSession
  charge?: ProviderChargeResult | null
  receipt?: PaymentReceipt | null
  invoice?: BookingInvoice | null
  events?: PaymentEvent[]
  message?: string
}): PaymentResult {
  return {
    success: input.success,
    session: input.session,
    charge: input.charge ?? null,
    receipt: input.receipt ?? null,
    invoice: input.invoice ?? null,
    events: [...(input.events ?? [])],
    message:
      input.message
      ?? (input.success ? 'Payment completed' : input.session.error ?? 'Payment failed'),
  }
}
