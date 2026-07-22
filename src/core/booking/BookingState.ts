/**
 * Sprint 94 — booking state helpers.
 */

import type { BookingStateName } from './types'

const TERMINAL: ReadonlySet<BookingStateName> = new Set([
  'Confirmed',
  'Completed',
  'Cancelled',
  'Expired',
])

export function isTerminalBookingState(state: BookingStateName): boolean {
  return TERMINAL.has(state)
}

export function canTransition(
  from: BookingStateName,
  to: BookingStateName,
): boolean {
  if (from === to) return true
  const allowed: Record<BookingStateName, BookingStateName[]> = {
    Pending: ['Started', 'Cancelled', 'Expired'],
    Started: ['Waiting', 'Retrying', 'Confirmed', 'PartiallyConfirmed', 'Cancelled', 'Expired'],
    Waiting: ['Confirmed', 'PartiallyConfirmed', 'Retrying', 'Cancelled', 'Expired'],
    Retrying: ['Waiting', 'Confirmed', 'PartiallyConfirmed', 'Cancelled', 'Expired'],
    Confirmed: ['Completed', 'Cancelled'],
    PartiallyConfirmed: ['Retrying', 'Confirmed', 'Cancelled', 'Completed'],
    Cancelled: [],
    Expired: [],
    Completed: [],
  }
  return allowed[from]?.includes(to) === true
}

export function deriveStateFromReservations(input: {
  reservations: Array<{ status: string; placeholder: boolean }>
  started: boolean
  retrying: boolean
  cancelled: boolean
  expired: boolean
}): BookingStateName {
  if (input.cancelled) return 'Cancelled'
  if (input.expired) return 'Expired'
  if (!input.started) return 'Pending'
  if (input.retrying) return 'Retrying'

  const real = input.reservations.filter((r) => !r.placeholder)
  const failed = real.filter((r) => r.status === 'failed')
  const reserved = input.reservations.filter((r) => r.status === 'reserved' || r.status === 'placeholder')

  if (real.length > 0 && failed.length === real.length) return 'Cancelled'
  if (failed.length > 0 && reserved.length > 0) return 'PartiallyConfirmed'
  if (reserved.length === input.reservations.length && input.reservations.length > 0) {
    return 'Confirmed'
  }
  if (reserved.length > 0) return 'Waiting'
  return 'Started'
}
