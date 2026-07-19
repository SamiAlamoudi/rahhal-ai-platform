/**
 * Sprint 34 — PaymentValidator
 */

import { PaymentPlatformError } from './PaymentErrors'
import {
  PLATFORM_PAYMENT_METHODS,
  SUPPORTED_CURRENCIES,
  type PayInput,
  type PaymentCheckoutInput,
  type PlatformPaymentMethod,
  type PlatformPaymentSession,
  type SupportedCurrency,
} from './types'

const DEFAULT_VAT: Record<SupportedCurrency, number> = {
  SAR: 0.15,
  USD: 0,
  EUR: 0.2,
  GBP: 0.2,
}

export class PaymentValidator {
  assertCheckoutInput(input: PaymentCheckoutInput): void {
    if (!input.executionSessionId) {
      throw new PaymentPlatformError('VALIDATION_FAILED', 'executionSessionId is required')
    }
    if (!input.conversationId) {
      throw new PaymentPlatformError('VALIDATION_FAILED', 'conversationId is required')
    }
    if (!SUPPORTED_CURRENCIES.includes(input.currency)) {
      throw new PaymentPlatformError(
        'VALIDATION_FAILED',
        `Unsupported currency: ${input.currency}`,
        { details: { currency: input.currency } },
      )
    }
    if (!(input.subtotal > 0)) {
      throw new PaymentPlatformError('VALIDATION_FAILED', 'subtotal must be positive')
    }
    if (input.couponCode && input.couponCode.length > 32) {
      throw new PaymentPlatformError('VALIDATION_FAILED', 'couponCode too long')
    }
  }

  assertPayInput(input: PayInput): void {
    if (!PLATFORM_PAYMENT_METHODS.includes(input.method)) {
      throw new PaymentPlatformError(
        'VALIDATION_FAILED',
        `Unsupported payment method: ${input.method}`,
      )
    }
  }

  assertCanPay(session: PlatformPaymentSession): void {
    if (!['INVENTORY_RESERVED', 'AWAITING_PAYMENT', 'FAILED'].includes(session.state)) {
      throw new PaymentPlatformError(
        'INVALID_STATE',
        `Cannot pay in state ${session.state}`,
        { details: { state: session.state } },
      )
    }
    if (session.state === 'PAID' || session.state === 'COMPLETED') {
      throw new PaymentPlatformError('DUPLICATE_PAYMENT', 'Payment already completed for session')
    }
  }

  assertNotDuplicatePaid(session: PlatformPaymentSession): void {
    if (
      session.state === 'PAID'
      || session.state === 'BOOKING_CONFIRMED'
      || session.state === 'INVOICED'
      || session.state === 'COMPLETED'
    ) {
      throw new PaymentPlatformError(
        'DUPLICATE_PAYMENT',
        'Duplicate payment rejected — session already paid',
        { details: { sessionId: session.sessionId, state: session.state } },
      )
    }
  }

  defaultVatRate(currency: SupportedCurrency, override?: number): number {
    if (typeof override === 'number') return Math.max(0, override)
    return DEFAULT_VAT[currency]
  }

  isSupportedMethod(method: PlatformPaymentMethod): boolean {
    return PLATFORM_PAYMENT_METHODS.includes(method)
  }
}

export function createPaymentValidator(): PaymentValidator {
  return new PaymentValidator()
}
