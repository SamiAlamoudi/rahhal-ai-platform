/**
 * Sprint 61 — Booking persistence records over BookingSessionStore.
 * Status vocabulary: Pending | Confirmed | Cancelled | Failed
 */

import type { MoneyAmount } from '../bookingIntelligence/types'
import type { BookingLifecycleStatus, UnifiedBooking } from './types'
import {
  BookingSessionStore,
  getDefaultBookingSessionStore,
} from './sessionStore'

export type PersistedBookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Failed'

export type PersistedBookingRecord = {
  bookingId: string
  conversationId: string | null
  sessionId: string
  provider: string
  providerReference: string | null
  travelerIds: string[]
  pricing: MoneyAmount
  status: PersistedBookingStatus
  domain: UnifiedBooking['domain']
  createdAt: string
  updatedAt: string
}

export function mapLifecycleToPersistedStatus(
  status: BookingLifecycleStatus,
): PersistedBookingStatus {
  switch (status) {
    case 'confirmed':
    case 'ticketed':
      return 'Confirmed'
    case 'cancelled':
    case 'expired':
      return 'Cancelled'
    case 'failed':
      return 'Failed'
    default:
      return 'Pending'
  }
}

export function travelerIdsFromBooking(booking: UnifiedBooking): string[] {
  return booking.travelerInfo.map(
    (t, i) =>
      `${t.firstName}.${t.lastName}.${i}`.toLowerCase().replace(/\s+/g, ''),
  )
}

export function toPersistedBookingRecord(booking: UnifiedBooking): PersistedBookingRecord {
  return {
    bookingId: booking.id,
    conversationId: booking.conversationId,
    sessionId: booking.sessionId,
    provider: booking.provider,
    providerReference: booking.providerBookingId ?? booking.confirmation,
    travelerIds: travelerIdsFromBooking(booking),
    pricing: { ...booking.pricing },
    status: mapLifecycleToPersistedStatus(booking.status),
    domain: booking.domain,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }
}

export class BookingRecordStore {
  private readonly records = new Map<string, PersistedBookingRecord>()
  private readonly sessions: BookingSessionStore

  constructor(sessions: BookingSessionStore = getDefaultBookingSessionStore()) {
    this.sessions = sessions
  }

  upsertFromUnified(booking: UnifiedBooking): PersistedBookingRecord {
    const record = toPersistedBookingRecord(booking)
    this.records.set(record.bookingId, structuredClone(record))
    // Keep session store booking mirror in sync when present.
    const session = this.sessions.get(booking.sessionId)
    if (session) {
      const bookings = session.bookings.map((b) => (b.id === booking.id ? booking : b))
      if (!bookings.some((b) => b.id === booking.id)) bookings.push(booking)
      this.sessions.save({ ...session, bookings, updatedAt: booking.updatedAt })
    }
    return structuredClone(record)
  }

  get(bookingId: string): PersistedBookingRecord | undefined {
    const record = this.records.get(bookingId)
    return record ? structuredClone(record) : undefined
  }

  list(filter?: { conversationId?: string; sessionId?: string }): PersistedBookingRecord[] {
    let rows = [...this.records.values()].map((r) => structuredClone(r))
    if (filter?.conversationId) {
      rows = rows.filter((r) => r.conversationId === filter.conversationId)
    }
    if (filter?.sessionId) {
      rows = rows.filter((r) => r.sessionId === filter.sessionId)
    }
    return rows
  }

  clear(): void {
    this.records.clear()
  }
}

let defaultRecords: BookingRecordStore | null = null

export function getDefaultBookingRecordStore(): BookingRecordStore {
  if (!defaultRecords) defaultRecords = new BookingRecordStore()
  return defaultRecords
}

export function resetDefaultBookingRecordStore(): void {
  defaultRecords?.clear()
  defaultRecords = null
}
