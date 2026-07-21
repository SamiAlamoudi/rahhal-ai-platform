/**
 * Sprint 62 — map Booking Execution / provider statuses → TripLifecycleStatus.
 */

import type { BookingLifecycleStatus } from '../bookingExecution/types'
import type { TripLifecycleStatus } from './types'

const STATUS_RANK: Record<TripLifecycleStatus, number> = {
  Pending: 1,
  Confirmed: 2,
  Ticketed: 3,
  CheckedIn: 4,
  Completed: 5,
  Expired: 6,
  Cancelled: 7,
  RefundPending: 8,
  Refunded: 9,
}

export function mapBookingLifecycleToTripStatus(
  status: BookingLifecycleStatus | string,
): TripLifecycleStatus {
  switch (String(status).toLowerCase()) {
    case 'draft':
    case 'pending':
    case 'payment_required':
      return 'Pending'
    case 'confirmed':
      return 'Confirmed'
    case 'ticketed':
      return 'Ticketed'
    case 'checkedin':
    case 'checked_in':
      return 'CheckedIn'
    case 'completed':
      return 'Completed'
    case 'cancelled':
    case 'canceled':
    case 'failed':
      return 'Cancelled'
    case 'expired':
      return 'Expired'
    case 'refundpending':
    case 'refund_pending':
      return 'RefundPending'
    case 'refunded':
      return 'Refunded'
    default:
      return 'Pending'
  }
}

export function mapProviderStatusToTripStatus(status: string): TripLifecycleStatus {
  return mapBookingLifecycleToTripStatus(status)
}

/**
 * Aggregate multiple booking statuses into one trip status.
 * Terminal refund/cancel/expiry win when they dominate; otherwise take highest progress.
 */
export function aggregateTripStatus(statuses: TripLifecycleStatus[]): TripLifecycleStatus {
  if (statuses.length === 0) return 'Pending'
  const all = [...statuses]
  if (all.every((s) => s === 'Refunded')) return 'Refunded'
  if (all.some((s) => s === 'RefundPending') && !all.every((s) => s === 'Refunded')) {
    return 'RefundPending'
  }
  if (all.every((s) => s === 'Cancelled' || s === 'Expired' || s === 'Refunded')) {
    if (all.some((s) => s === 'Expired') && !all.some((s) => s === 'Cancelled')) return 'Expired'
    if (all.every((s) => s === 'Expired')) return 'Expired'
    return 'Cancelled'
  }
  if (all.every((s) => s === 'Completed')) return 'Completed'
  const active = all.filter(
    (s) =>
      s !== 'Cancelled'
      && s !== 'Expired'
      && s !== 'Refunded'
      && s !== 'RefundPending',
  )
  if (active.length === 0) {
    return all.reduce((best, s) => (STATUS_RANK[s] > STATUS_RANK[best] ? s : best), all[0]!)
  }
  return active.reduce((best, s) => (STATUS_RANK[s] > STATUS_RANK[best] ? s : best), active[0]!)
}

export function isTerminalTripStatus(status: TripLifecycleStatus): boolean {
  return (
    status === 'Completed'
    || status === 'Cancelled'
    || status === 'Expired'
    || status === 'Refunded'
  )
}

export function isActiveTripStatus(status: TripLifecycleStatus): boolean {
  return (
    status === 'Pending'
    || status === 'Confirmed'
    || status === 'Ticketed'
    || status === 'CheckedIn'
    || status === 'RefundPending'
  )
}
