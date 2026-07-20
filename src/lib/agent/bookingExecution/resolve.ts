/**
 * Resolve a prior Booking Execution session for later payment / confirmation turns.
 * Alpha wiring — connects Execution → Payments across conversation turns.
 */

import { getDefaultBookingSessionStore } from './sessionStore'
import type { BookingExecutionResult, BookingExecutionSession } from './types'

export function bookingExecutionResultFromSession(
  session: BookingExecutionSession,
): BookingExecutionResult {
  const confirmedCount = session.bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'ticketed',
  ).length
  const failedCount = session.bookings.filter((b) => b.status === 'failed').length
  const cancelledCount = session.bookings.filter((b) => b.status === 'cancelled').length
  const expiredCount = session.bookings.filter((b) => b.status === 'expired').length
  return {
    snapshot: {
      version: 1,
      sessionId: session.id,
      status: session.status,
      bookingIds: session.bookings.map((b) => b.id),
      confirmedCount,
      failedCount,
      cancelledCount,
      expiredCount,
      domains: [...new Set(session.items.map((i) => i.domain))],
      providerIds: [...new Set(session.items.map((i) => i.providerId))],
      durationMs: 0,
      resumed: true,
      rolledBack: false,
      idempotentReplay: false,
    },
    session,
    bookings: session.bookings,
    events: [],
    audit: [],
    executionFacts: [
      `Resumed booking session ${session.id} status=${session.status}`,
      `Confirmed bookings: ${confirmedCount}`,
    ],
  }
}

/** Latest confirmed (or ticketed) booking execution for this conversation/user. */
export function findLatestConfirmedBookingExecution(
  userId: string,
): BookingExecutionResult | null {
  const sessions = getDefaultBookingSessionStore()
    .list()
    .filter((s) => s.userId === userId)
    .filter((s) =>
      s.bookings.some((b) => b.status === 'confirmed' || b.status === 'ticketed')
      || s.status === 'confirmed'
      || s.status === 'ticketed'
      || s.status === 'payment_required',
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const latest = sessions[0]
  if (!latest) return null
  return bookingExecutionResultFromSession(latest)
}
