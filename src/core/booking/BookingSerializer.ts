/**
 * Sprint 94 — booking session / summary serialization.
 */

import type { BookingSession, BookingSummary } from './types'

export function buildBookingSummary(session: BookingSession): BookingSummary {
  const confirmations = session.reservations
    .map((r) => r.confirmationCode)
    .filter((c): c is string => Boolean(c))

  return {
    sessionId: session.sessionId,
    state: session.state,
    reservationIds: session.reservationIds,
    pricing: {
      quotedTotal: session.quotedTotal,
      lockedTotal: session.lockedTotal,
      currency: session.currency,
    },
    provider: session.provider,
    confirmation: confirmations[0] ?? null,
    warnings: session.warnings,
    paymentRequired: session.paymentRequired,
    reservations: session.reservations,
  }
}

export function serializeBookingSession(session: BookingSession): string {
  return JSON.stringify(session)
}

export function deserializeBookingSession(raw: string): BookingSession {
  const parsed = JSON.parse(raw) as BookingSession
  if (!parsed?.sessionId || !parsed?.plan) {
    throw new Error('invalid_booking_session')
  }
  return parsed
}

export function serializeBookingSummary(summary: BookingSummary): string {
  return JSON.stringify(summary)
}
