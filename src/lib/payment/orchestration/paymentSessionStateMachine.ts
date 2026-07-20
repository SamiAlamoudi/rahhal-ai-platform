/**
 * PaymentSession state machine — explicit allowed transitions + guards.
 * All orchestration status changes must go through `transitionPaymentSession`.
 */

import type { PaymentSession, PaymentSessionStatus } from '../paymentTypes'

export type PaymentSessionEvent =
  | 'submit'
  | 'authorize'
  | 'capture'
  | 'fail'
  | 'expire'
  | 'cancel'
  | 'refund'
  | 'mark_paid'

/** Allowed from → to transitions. */
export const PAYMENT_SESSION_TRANSITIONS: Readonly<Record<PaymentSessionStatus, readonly PaymentSessionStatus[]>> = {
  created: ['pending', 'cancelled', 'expired', 'failed'],
  pending: ['authorized', 'paid', 'failed', 'expired', 'cancelled'],
  authorized: ['paid', 'failed', 'cancelled', 'refunded'],
  paid: ['refunded'],
  failed: ['pending', 'cancelled'],
  expired: [],
  cancelled: [],
  refunded: [],
}

export class PaymentSessionTransitionError extends Error {
  readonly code = 'invalid_payment_transition'
  readonly from: PaymentSessionStatus
  readonly to: PaymentSessionStatus

  constructor(from: PaymentSessionStatus, to: PaymentSessionStatus) {
    super(`Invalid payment session transition: ${from} → ${to}`)
    this.name = 'PaymentSessionTransitionError'
    this.from = from
    this.to = to
  }
}

export function canTransitionPaymentSession(
  from: PaymentSessionStatus,
  to: PaymentSessionStatus,
): boolean {
  if (from === to) return true
  return PAYMENT_SESSION_TRANSITIONS[from].includes(to)
}

export function assertCanTransitionPaymentSession(
  from: PaymentSessionStatus,
  to: PaymentSessionStatus,
): void {
  if (!canTransitionPaymentSession(from, to)) {
    throw new PaymentSessionTransitionError(from, to)
  }
}

/**
 * Map a high-level event to a target status given the current status.
 */
export function resolvePaymentSessionEvent(
  current: PaymentSessionStatus,
  event: PaymentSessionEvent,
): PaymentSessionStatus {
  switch (event) {
    case 'submit':
      return current === 'created' ? 'pending' : current
    case 'authorize':
      return 'authorized'
    case 'capture':
    case 'mark_paid':
      return 'paid'
    case 'fail':
      return 'failed'
    case 'expire':
      return 'expired'
    case 'cancel':
      return 'cancelled'
    case 'refund':
      return 'refunded'
    default:
      return current
  }
}

export interface TransitionPaymentSessionInput {
  session: PaymentSession
  to: PaymentSessionStatus
  patch?: Partial<Pick<
    PaymentSession,
    | 'providerReference'
    | 'authorizationCode'
    | 'transactionId'
    | 'redirectUrl'
    | 'paymentMethod'
    | 'paidAt'
    | 'metadata'
  >>
  /** When true, skip transition validation (use only for hydration). */
  force?: boolean
}

export interface TransitionPaymentSessionResult {
  session: PaymentSession
  from: PaymentSessionStatus
  to: PaymentSessionStatus
  changed: boolean
}

export function transitionPaymentSession(
  input: TransitionPaymentSessionInput,
): TransitionPaymentSessionResult {
  const from = input.session.status
  const to = input.to
  if (!input.force) {
    assertCanTransitionPaymentSession(from, to)
  }

  if (from === to && !input.patch) {
    return { session: input.session, from, to, changed: false }
  }

  const now = new Date().toISOString()
  const session: PaymentSession = {
    ...input.session,
    ...input.patch,
    status: to,
    updatedAt: now,
    paidAt: to === 'paid'
      ? (input.patch?.paidAt ?? input.session.paidAt ?? now)
      : input.session.paidAt,
    metadata: {
      ...input.session.metadata,
      ...input.patch?.metadata,
      lastTransition: { from, to, at: now },
    },
  }

  return { session, from, to, changed: from !== to || Boolean(input.patch) }
}

export function applyPaymentSessionEvent(
  session: PaymentSession,
  event: PaymentSessionEvent,
  patch?: TransitionPaymentSessionInput['patch'],
): TransitionPaymentSessionResult {
  const to = resolvePaymentSessionEvent(session.status, event)
  return transitionPaymentSession({ session, to, patch })
}

/** Terminal statuses — no further business transitions expected. */
export function isTerminalPaymentStatus(status: PaymentSessionStatus): boolean {
  return status === 'paid'
    || status === 'refunded'
    || status === 'expired'
    || status === 'cancelled'
}
