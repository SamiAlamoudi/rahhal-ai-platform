/**
 * My Trips lifecycle helpers — resume / cancel eligibility for durable booking sessions.
 */

import type { BookingStatus } from './bookingTypes'

const TERMINAL: ReadonlySet<BookingStatus> = new Set([
  'confirmed',
  'cancelled',
  'expired',
])

const RESUMABLE: ReadonlySet<BookingStatus> = new Set([
  'draft',
  'selected',
  'ready_to_redirect',
  'redirected',
  'pending_provider_confirmation',
])

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL.has(status)
}

export function canResumeBookingSession(status: BookingStatus): boolean {
  return RESUMABLE.has(status)
}

export function canCancelBookingSession(status: BookingStatus): boolean {
  return !TERMINAL.has(status)
}
