/**
 * Sprint 94 — booking session factory / mutators.
 */

import type {
  BookableTraveler,
  BookingPlan,
  BookingReservation,
  BookingSession,
  BookingStateName,
} from './types'
import { canTransition } from './BookingState'

export function createBookingSession(input: {
  sessionId: string
  tripId: string
  provider: string
  plan: BookingPlan
  travelers: BookableTraveler[]
  quotedTotal: number
  currency: string
  timeoutMs?: number
  now?: () => number
}): BookingSession {
  const now = input.now ?? Date.now
  const ts = now()
  const timeoutMs = input.timeoutMs ?? 15 * 60_000
  return {
    sessionId: input.sessionId,
    tripId: input.tripId,
    provider: input.provider,
    state: 'Pending',
    reservationIds: [],
    reservations: [],
    plan: input.plan,
    travelers: input.travelers,
    quotedTotal: input.quotedTotal,
    lockedTotal: null,
    currency: input.currency,
    createdAt: new Date(ts).toISOString(),
    updatedAt: new Date(ts).toISOString(),
    startedAt: null,
    completedAt: null,
    expiresAt: new Date(ts + timeoutMs).toISOString(),
    rollback: {
      required: false,
      completed: false,
      reservationIds: [],
      reason: null,
    },
    warnings: [],
    paymentRequired: true,
    lastError: null,
    retryCount: 0,
  }
}

export function touchSession(
  session: BookingSession,
  now: () => number = Date.now,
): BookingSession {
  return {
    ...session,
    updatedAt: new Date(now()).toISOString(),
  }
}

export function transitionSession(
  session: BookingSession,
  state: BookingStateName,
  now: () => number = Date.now,
): BookingSession {
  if (!canTransition(session.state, state)) {
    return session
  }
  const next = touchSession({ ...session, state }, now)
  if (state === 'Started' && !next.startedAt) {
    next.startedAt = new Date(now()).toISOString()
  }
  if (state === 'Completed' || state === 'Confirmed') {
    next.completedAt = new Date(now()).toISOString()
    if (state === 'Confirmed') {
      // Confirmed may still require payment → stay paymentRequired.
    }
  }
  if (state === 'Completed') {
    next.paymentRequired = false
  }
  return next
}

export function attachReservation(
  session: BookingSession,
  reservation: BookingReservation,
  now: () => number = Date.now,
): BookingSession {
  const reservations = [...session.reservations.filter((r) => r.stepId !== reservation.stepId), reservation]
  const reservationIds = reservations
    .filter((r) => r.status === 'reserved' || r.status === 'placeholder')
    .map((r) => r.reservationId)
  return touchSession({
    ...session,
    reservations,
    reservationIds,
  }, now)
}
