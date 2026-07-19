/**
 * Sprint 35 — TripTimeline lifecycle buckets.
 * File named TripLifecycleTimeline.ts to avoid casing clash with tripTimeline.ts.
 * Reuses ManagedTrip statuses / TripHistory; does not replace buildTripTimeline().
 */

import { TripHistory } from './tripHistory'
import type { ManagedTrip } from './types'
import type { PostBookingTripRecord, TripLifecycleBucket } from './postBookingTypes'

export class TripTimeline {
  private readonly history = new TripHistory()

  /**
   * Map managed status → Sprint 35 lifecycle bucket.
   */
  toLifecycle(status: ManagedTrip['status']): TripLifecycleBucket {
    switch (status) {
      case 'active':
        return 'Active'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      case 'upcoming':
      case 'draft':
      default:
        return 'Upcoming'
    }
  }

  partitionManaged(trips: ManagedTrip[]): Record<TripLifecycleBucket, ManagedTrip[]> {
    const buckets = this.history.partition(trips)
    return {
      Upcoming: buckets.upcoming.filter((t) => t.status !== 'active'),
      Active: buckets.upcoming.filter((t) => t.status === 'active').concat(
        buckets.activeBookings.filter((t) => t.status === 'active'),
      ).filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i),
      Completed: buckets.past,
      Cancelled: buckets.cancelled,
    }
  }

  partitionPostBooking(
    records: PostBookingTripRecord[],
  ): Record<TripLifecycleBucket, PostBookingTripRecord[]> {
    return {
      Upcoming: records.filter((r) => r.lifecycle === 'Upcoming'),
      Active: records.filter((r) => r.lifecycle === 'Active'),
      Completed: records.filter((r) => r.lifecycle === 'Completed'),
      Cancelled: records.filter((r) => r.lifecycle === 'Cancelled'),
    }
  }

  /**
   * Chronological ordering: Active → Upcoming → Completed → Cancelled.
   */
  orderForDisplay(records: PostBookingTripRecord[]): PostBookingTripRecord[] {
    const rank: Record<TripLifecycleBucket, number> = {
      Active: 0,
      Upcoming: 1,
      Completed: 2,
      Cancelled: 3,
    }
    return [...records].sort((a, b) => {
      const byLife = rank[a.lifecycle] - rank[b.lifecycle]
      if (byLife !== 0) return byLife
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }
}

export function createTripTimeline(): TripTimeline {
  return new TripTimeline()
}
