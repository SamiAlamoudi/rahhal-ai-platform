/**
 * Sprint 34 — PaymentIntentService
 */

import { PaymentPlatformError } from './PaymentErrors'
import type { PaymentSessionStore } from './PaymentSession'
import { buildTaxBreakdown } from './pricing'
import { PaymentValidator } from './PaymentValidator'
import type {
  PaymentCheckoutInput,
  PaymentIntent,
  PlatformPaymentSession,
} from './types'

export class PaymentIntentService {
  private readonly sessions: PaymentSessionStore
  private readonly validator: PaymentValidator

  constructor(sessions: PaymentSessionStore, validator: PaymentValidator = new PaymentValidator()) {
    this.sessions = sessions
    this.validator = validator
  }

  createIntent(input: PaymentCheckoutInput): PlatformPaymentSession {
    this.validator.assertCheckoutInput(input)

    const idempotencyKey =
      input.idempotencyKey
      ?? `idem_${input.executionSessionId}_${input.conversationId}_${input.subtotal}_${input.currency}`

    const existing = this.sessions.findByIdempotencyKey(idempotencyKey)
    if (existing) {
      if (this.sessions.isIntentPaid(existing.intent.intentId)) {
        throw new PaymentPlatformError(
          'DUPLICATE_PAYMENT',
          'Payment intent already charged',
          { details: { intentId: existing.intent.intentId } },
        )
      }
      return existing
    }

    const now = new Date().toISOString()
    const sessionId = `ps_${Math.random().toString(36).slice(2, 10)}`
    const intentId = `pi_${Math.random().toString(36).slice(2, 10)}`
    const vatRate = this.validator.defaultVatRate(input.currency, input.vatRate)
    const pricing = buildTaxBreakdown({
      currency: input.currency,
      subtotal: input.subtotal,
      vatRate,
      providerFees: input.providerFees,
      serviceFees: input.serviceFees,
      couponCode: input.couponCode,
    })

    const intent: PaymentIntent = {
      intentId,
      sessionId,
      executionSessionId: input.executionSessionId,
      conversationId: input.conversationId,
      amount: pricing.total,
      currency: input.currency,
      description:
        input.description
        ?? `Bilamo trip payment (${input.currency} ${pricing.total})`,
      providerId: null,
      status: 'created',
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    }

    const session: PlatformPaymentSession = {
      sessionId,
      state: 'INTENT_CREATED',
      intent,
      inventory: null,
      pricing,
      method: null,
      providerId: null,
      providerChargeId: null,
      customerEmail: input.customerEmail ?? null,
      customerName: input.customerName ?? null,
      locale: input.locale === 'ar' ? 'ar' : 'en',
      bookingRefs: null,
      receiptId: null,
      invoiceId: null,
      refundIds: [],
      refundedAmount: 0,
      warnings: [],
      error: null,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
      completedAt: null,
      metadata: {
        tripId: input.tripId ?? null,
        preferredProviderId: input.preferredProviderId ?? null,
        flightConfirmation: input.flightConfirmation ?? null,
        hotelConfirmation: input.hotelConfirmation ?? null,
        bookingReferenceHint: input.bookingReferenceHint ?? null,
        tripReferenceHint: input.tripReferenceHint ?? null,
        ...input.metadata,
      },
    }

    return this.sessions.create(session)
  }

  getIntent(sessionId: string): PaymentIntent {
    return this.sessions.get(sessionId).intent
  }
}
