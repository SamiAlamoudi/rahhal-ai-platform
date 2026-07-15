/**
 * TicketSession state machine — guarded transitions for the ticketing lifecycle.
 */

import type { TicketSessionStatus } from './types'

export type TicketSessionEvent =
  | 'queue'
  | 'start_issuing'
  | 'mark_issued'
  | 'deliver'
  | 'fail'
  | 'expire'
  | 'cancel'
  | 'void'
  | 'require_reissue'

export const TICKET_SESSION_TRANSITIONS: Readonly<Record<TicketSessionStatus, readonly TicketSessionStatus[]>> = {
  created: ['pending', 'cancelled', 'expired'],
  pending: ['issuing', 'cancelled', 'expired', 'failed'],
  issuing: ['issued', 'failed', 'cancelled', 'expired', 'reissue_required'],
  issued: ['delivered', 'voided', 'reissue_required', 'cancelled'],
  delivered: ['voided', 'reissue_required'],
  failed: ['pending', 'cancelled', 'reissue_required'],
  expired: [],
  cancelled: [],
  voided: ['reissue_required'],
  reissue_required: ['pending', 'issuing', 'cancelled'],
}

export class TicketSessionTransitionError extends Error {
  readonly code = 'invalid_ticket_transition'
  readonly from: TicketSessionStatus
  readonly to: TicketSessionStatus

  constructor(from: TicketSessionStatus, to: TicketSessionStatus) {
    super(`Invalid ticket session transition: ${from} → ${to}`)
    this.name = 'TicketSessionTransitionError'
    this.from = from
    this.to = to
  }
}

export function canTransitionTicketSession(
  from: TicketSessionStatus,
  to: TicketSessionStatus,
): boolean {
  if (from === to) return true
  return TICKET_SESSION_TRANSITIONS[from].includes(to)
}

export function assertCanTransitionTicketSession(
  from: TicketSessionStatus,
  to: TicketSessionStatus,
): void {
  if (!canTransitionTicketSession(from, to)) {
    throw new TicketSessionTransitionError(from, to)
  }
}

export function resolveTicketSessionEvent(
  current: TicketSessionStatus,
  event: TicketSessionEvent,
): TicketSessionStatus {
  switch (event) {
    case 'queue':
      return current === 'created' || current === 'failed' || current === 'reissue_required'
        ? 'pending'
        : current
    case 'start_issuing':
      return 'issuing'
    case 'mark_issued':
      return 'issued'
    case 'deliver':
      return 'delivered'
    case 'fail':
      return 'failed'
    case 'expire':
      return 'expired'
    case 'cancel':
      return 'cancelled'
    case 'void':
      return 'voided'
    case 'require_reissue':
      return 'reissue_required'
    default:
      return current
  }
}

export function isTerminalTicketStatus(status: TicketSessionStatus): boolean {
  return status === 'delivered'
    || status === 'expired'
    || status === 'cancelled'
    || status === 'voided'
}
