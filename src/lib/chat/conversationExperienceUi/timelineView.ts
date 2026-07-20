/**
 * Sprint 42 — trip timeline presentation over Sprint 35 lifecycle + booking states.
 */

import type { PostBookingTripRecord, TripLifecycleBucket } from '../../trips/postBookingTypes'
import type { BookingTimelineEntry } from '../../execution'

export type ConversationTimelineStatus =
  | 'Upcoming'
  | 'Booked'
  | 'Paid'
  | 'Checked-in'
  | 'Completed'
  | 'Cancelled'
  | 'Refunded'

export interface ConversationTimelineEvent {
  id: string
  status: ConversationTimelineStatus
  title: string
  detail: string
  at: string
  tripId: string | null
  bookingReference: string | null
}

export function mapLifecycleToTimelineStatus(
  lifecycle: TripLifecycleBucket,
  refundStatus?: string | null,
): ConversationTimelineStatus {
  if (refundStatus && refundStatus !== 'none' && refundStatus !== 'failed') {
    if (refundStatus === 'completed' || refundStatus === 'partial') return 'Refunded'
  }
  switch (lifecycle) {
    case 'Active':
      return 'Checked-in'
    case 'Completed':
      return 'Completed'
    case 'Cancelled':
      return 'Cancelled'
    case 'Upcoming':
    default:
      return 'Upcoming'
  }
}

export function buildConversationTimeline(input: {
  trips?: PostBookingTripRecord[]
  executionTimeline?: BookingTimelineEntry[]
  bookingReference?: string | null
  paid?: boolean
}): ConversationTimelineEvent[] {
  const events: ConversationTimelineEvent[] = []

  for (const trip of input.trips ?? []) {
    const status = mapLifecycleToTimelineStatus(trip.lifecycle, trip.refundStatus)
    const paid = trip.totalPaid > 0
    events.push({
      id: `trip-${trip.tripId}`,
      status: paid && status === 'Upcoming' ? 'Paid' : status === 'Upcoming' ? 'Booked' : status,
      title: trip.destination,
      detail: `${trip.references.bookingReference} · ${trip.lifecycle}`,
      at: trip.updatedAt,
      tripId: trip.tripId,
      bookingReference: trip.references.bookingReference,
    })
  }

  for (const entry of input.executionTimeline ?? []) {
    events.push({
      id: entry.id,
      status: entry.state === 'COMPLETED' ? (input.paid ? 'Paid' : 'Booked') : 'Upcoming',
      title: entry.label,
      detail: entry.detail ?? entry.state,
      at: entry.at,
      tripId: null,
      bookingReference: input.bookingReference ?? null,
    })
  }

  return events.sort((a, b) => b.at.localeCompare(a.at))
}
