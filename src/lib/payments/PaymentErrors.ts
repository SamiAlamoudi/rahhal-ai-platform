/**
 * Sprint 34 — Payments platform domain errors.
 */

export type PaymentErrorCode =
  | 'FEATURE_DISABLED'
  | 'VALIDATION_FAILED'
  | 'SESSION_NOT_FOUND'
  | 'INTENT_NOT_FOUND'
  | 'DUPLICATE_PAYMENT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_TIMEOUT'
  | 'INVALID_STATE'
  | 'REFUND_FAILED'
  | 'INVENTORY_RELEASE_FAILED'
  | 'UNKNOWN'

export class PaymentPlatformError extends Error {
  readonly code: PaymentErrorCode
  readonly retryable: boolean
  readonly details: Record<string, unknown>

  constructor(
    code: PaymentErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message)
    this.name = 'PaymentPlatformError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.details = options?.details ?? {}
  }
}

export function isPaymentPlatformError(error: unknown): error is PaymentPlatformError {
  return error instanceof PaymentPlatformError
}
