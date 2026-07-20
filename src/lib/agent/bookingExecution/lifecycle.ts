/**
 * Booking lifecycle transitions — Sprint 57.
 */

import type { BookingLifecycleStatus } from './types'

const ALLOWED: Record<BookingLifecycleStatus, readonly BookingLifecycleStatus[]> = {
  draft: ['pending', 'payment_required', 'cancelled', 'expired', 'failed'],
  pending: ['payment_required', 'confirmed', 'failed', 'cancelled', 'expired'],
  payment_required: ['pending', 'confirmed', 'failed', 'cancelled', 'expired'],
  confirmed: ['ticketed', 'cancelled', 'failed'],
  ticketed: ['cancelled'],
  cancelled: [],
  failed: [],
  expired: [],
}

export function canTransition(
  from: BookingLifecycleStatus,
  to: BookingLifecycleStatus,
): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export function assertTransition(
  from: BookingLifecycleStatus,
  to: BookingLifecycleStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid_lifecycle_transition:${from}->${to}`)
  }
}

export function isTerminalStatus(status: BookingLifecycleStatus): boolean {
  return status === 'cancelled' || status === 'failed' || status === 'expired' || status === 'ticketed'
}

export function isSuccessStatus(status: BookingLifecycleStatus): boolean {
  return status === 'confirmed' || status === 'ticketed'
}
