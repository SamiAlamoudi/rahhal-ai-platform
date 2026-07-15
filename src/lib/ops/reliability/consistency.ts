/**
 * Cross-domain consistency checks: booking ↔ payment ↔ ticketing ↔ notification.
 * Uses ids/status summaries only — provider-blind.
 */

export interface ConsistencySubject {
  bookingSessionId?: string | null
  bookingStatus?: string | null
  orderId?: string | null
  orderStatus?: string | null
  paymentSessionId?: string | null
  paymentStatus?: string | null
  ticketSessionId?: string | null
  ticketStatus?: string | null
  notificationSessionIds?: string[]
  notificationStatuses?: string[]
}

export interface ConsistencyIssue {
  code: string
  message: string
  severity: 'info' | 'warn' | 'error'
}

export interface ConsistencyReport {
  ok: boolean
  issues: ConsistencyIssue[]
}

export function checkFlowConsistency(subject: ConsistencySubject): ConsistencyReport {
  const issues: ConsistencyIssue[] = []

  if (subject.paymentStatus === 'paid' && !subject.orderId && !subject.bookingSessionId) {
    issues.push({
      code: 'orphan_payment',
      message: 'Paid payment has no linked order/booking',
      severity: 'error',
    })
  }

  if (
    (subject.ticketStatus === 'issued' || subject.ticketStatus === 'delivered')
    && subject.paymentStatus
    && subject.paymentStatus !== 'paid'
    && subject.orderStatus !== 'paid'
    && subject.orderStatus !== 'confirmed'
  ) {
    issues.push({
      code: 'ticket_without_payment',
      message: 'Ticket issued without captured payment',
      severity: 'error',
    })
  }

  if (subject.bookingStatus === 'cancelled' && subject.ticketStatus === 'issued') {
    issues.push({
      code: 'cancelled_booking_active_ticket',
      message: 'Booking cancelled but ticket still issued',
      severity: 'warn',
    })
  }

  if (
    (subject.ticketStatus === 'issued' || subject.ticketStatus === 'delivered')
    && (subject.notificationStatuses?.length ?? 0) === 0
    && (subject.notificationSessionIds?.length ?? 0) === 0
  ) {
    issues.push({
      code: 'missing_ticket_notification',
      message: 'Ticket issued without notification trail',
      severity: 'info',
    })
  }

  if (subject.orderId && subject.paymentSessionId === null && subject.paymentStatus === 'paid') {
    issues.push({
      code: 'paid_without_session',
      message: 'Order marked paid without payment session id',
      severity: 'warn',
    })
  }

  const ok = !issues.some((i) => i.severity === 'error')
  return { ok, issues }
}
