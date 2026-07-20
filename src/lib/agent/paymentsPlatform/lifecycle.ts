import type { PaymentLifecycleStatus } from './types'

const ALLOWED: Record<PaymentLifecycleStatus, readonly PaymentLifecycleStatus[]> = {
  pending: ['authorized', 'failed', 'cancelled', 'expired'],
  authorized: ['captured', 'partially_captured', 'failed', 'cancelled', 'expired'],
  captured: ['partially_captured', 'refund_pending', 'chargeback', 'cancelled'],
  partially_captured: ['captured', 'refund_pending', 'chargeback', 'cancelled'],
  refund_pending: ['refunded', 'failed', 'captured'],
  refunded: ['chargeback'],
  failed: [],
  cancelled: [],
  expired: [],
  chargeback: [],
}

export function canTransitionPayment(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export function assertPaymentTransition(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`invalid_payment_transition:${from}->${to}`)
  }
}

export function isPaymentSuccess(status: PaymentLifecycleStatus): boolean {
  return status === 'captured' || status === 'partially_captured'
}
