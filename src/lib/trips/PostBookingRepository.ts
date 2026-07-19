/**
 * Sprint 35 — in-memory store for post-booking trip records.
 * Complements TripRepository (ManagedTrip); does not replace it.
 */

import type { PostBookingTripRecord } from './postBookingTypes'

export class PostBookingRepository {
  private readonly byId = new Map<string, PostBookingTripRecord>()
  private readonly byUser = new Map<string, Set<string>>()
  private readonly byPaymentSession = new Map<string, string>()

  save(record: PostBookingTripRecord): PostBookingTripRecord {
    const clone = cloneRecord(record)
    this.byId.set(clone.tripId, clone)
    const set = this.byUser.get(clone.userId) ?? new Set()
    set.add(clone.tripId)
    this.byUser.set(clone.userId, set)
    if (clone.references.paymentSessionId) {
      this.byPaymentSession.set(clone.references.paymentSessionId, clone.tripId)
    }
    return cloneRecord(clone)
  }

  get(tripId: string): PostBookingTripRecord | null {
    const row = this.byId.get(tripId)
    return row ? cloneRecord(row) : null
  }

  getByPaymentSession(paymentSessionId: string): PostBookingTripRecord | null {
    const tripId = this.byPaymentSession.get(paymentSessionId)
    return tripId ? this.get(tripId) : null
  }

  listByUser(userId: string): PostBookingTripRecord[] {
    const ids = this.byUser.get(userId)
    if (!ids) return []
    return [...ids]
      .map((id) => this.byId.get(id))
      .filter((r): r is PostBookingTripRecord => Boolean(r))
      .map(cloneRecord)
  }

  clear(): void {
    this.byId.clear()
    this.byUser.clear()
    this.byPaymentSession.clear()
  }
}

function cloneRecord(record: PostBookingTripRecord): PostBookingTripRecord {
  return {
    ...record,
    references: { ...record.references },
    documents: {
      ...record.documents,
      itinerary: {
        ...record.documents.itinerary,
        days: record.documents.itinerary.days.map((d) => ({
          ...d,
          items: [...d.items],
        })),
      },
      bookingSummary: { ...record.documents.bookingSummary },
      hotelVoucher: record.documents.hotelVoucher
        ? { ...record.documents.hotelVoucher }
        : null,
      eTicket: record.documents.eTicket ? { ...record.documents.eTicket } : null,
      boardingPass: record.documents.boardingPass
        ? { ...record.documents.boardingPass }
        : null,
      pdfItinerary: { ...record.documents.pdfItinerary },
      invoiceBundle: { ...record.documents.invoiceBundle },
    },
    flightStatus: record.flightStatus ? { ...record.flightStatus } : null,
    notifications: record.notifications.map((n) => ({
      ...n,
      channels: [...n.channels],
    })),
  }
}

let shared: PostBookingRepository | null = null

export function getPostBookingRepository(): PostBookingRepository {
  if (!shared) shared = new PostBookingRepository()
  return shared
}

export function resetPostBookingRepository(): void {
  shared?.clear()
  shared = null
}
