/**
 * Sprint 35 — RefundStatusTracker (status only; refunds executed by payments platform).
 */

import type { PostBookingTripRecord, RefundTrackingStatus } from './postBookingTypes'

export class RefundStatusTracker {
  request(record: PostBookingTripRecord): PostBookingTripRecord {
    return this.set(record, 'requested', record.refundedAmount)
  }

  markProcessing(record: PostBookingTripRecord): PostBookingTripRecord {
    return this.set(record, 'processing', record.refundedAmount)
  }

  markPartial(record: PostBookingTripRecord, amount: number): PostBookingTripRecord {
    return this.set(record, 'partial', amount)
  }

  markCompleted(record: PostBookingTripRecord, amount: number): PostBookingTripRecord {
    return this.set(record, 'completed', amount)
  }

  markFailed(record: PostBookingTripRecord): PostBookingTripRecord {
    return this.set(record, 'failed', record.refundedAmount)
  }

  private set(
    record: PostBookingTripRecord,
    status: RefundTrackingStatus,
    refundedAmount: number,
  ): PostBookingTripRecord {
    return {
      ...record,
      refundStatus: status,
      refundedAmount,
      updatedAt: new Date().toISOString(),
    }
  }
}

export function createRefundStatusTracker(): RefundStatusTracker {
  return new RefundStatusTracker()
}
