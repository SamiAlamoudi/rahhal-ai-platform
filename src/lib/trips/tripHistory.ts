/**
 * TripHistory — upcoming / past / cancelled trip partitions.
 */

import type { ManagedTrip, ManagedTripStatus } from './types'

export interface TripHistoryBuckets {
  all: ManagedTrip[]
  upcoming: ManagedTrip[]
  past: ManagedTrip[]
  cancelled: ManagedTrip[]
  archived: ManagedTrip[]
  activeBookings: ManagedTrip[]
}

const UPCOMING: ManagedTripStatus[] = ['upcoming', 'active', 'draft']
const PAST: ManagedTripStatus[] = ['completed']

export class TripHistory {
  partition(trips: ManagedTrip[]): TripHistoryBuckets {
    const nonArchived = trips.filter((t) => !t.archived && t.status !== 'archived')
    return {
      all: [...trips],
      upcoming: nonArchived.filter((t) => UPCOMING.includes(t.status)),
      past: nonArchived.filter((t) => PAST.includes(t.status)),
      cancelled: trips.filter((t) => t.status === 'cancelled'),
      archived: trips.filter((t) => t.archived || t.status === 'archived'),
      activeBookings: nonArchived.filter((t) => {
        const booking = t.summary.primaryBookingStatus
        return t.status === 'upcoming'
          || t.status === 'active'
          || booking === 'confirmed'
          || booking === 'pending_provider_confirmation'
          || booking === 'redirected'
      }),
    }
  }
}
