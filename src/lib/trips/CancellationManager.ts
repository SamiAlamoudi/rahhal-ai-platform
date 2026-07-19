/**
 * Sprint 35 — CancellationManager.
 * Uses existing TripManager.cancelBooking when available; tracks post-booking lifecycle.
 */

import type { TripManager } from './tripManager'
import type { PostBookingTripRecord, TripLifecycleBucket } from './postBookingTypes'

export interface CancellationResult {
  success: boolean
  tripId: string
  lifecycle: TripLifecycleBucket
  reason: string
  cancelledAt: string
}

export class CancellationManager {
  private readonly tripManager: TripManager | null

  constructor(tripManager: TripManager | null = null) {
    this.tripManager = tripManager
  }

  cancelManagedTrip(tripId: string, userId: string, reason?: string) {
    if (!this.tripManager) {
      throw new Error('TripManager is required for managed trip cancellation')
    }
    return this.tripManager.cancelBooking(tripId, userId, reason)
  }

  cancelPostBooking(
    record: PostBookingTripRecord,
    reason = 'user_cancelled',
  ): { record: PostBookingTripRecord; result: CancellationResult } {
    const cancelledAt = new Date().toISOString()
    const next: PostBookingTripRecord = {
      ...record,
      lifecycle: 'Cancelled',
      managedStatus: 'cancelled',
      updatedAt: cancelledAt,
    }
    return {
      record: next,
      result: {
        success: true,
        tripId: record.tripId,
        lifecycle: 'Cancelled',
        reason,
        cancelledAt,
      },
    }
  }
}

export function createCancellationManager(
  tripManager?: TripManager | null,
): CancellationManager {
  return new CancellationManager(tripManager ?? null)
}
