/**
 * Booking Sessions — Sprint 57.
 * Resume after interruption, execution state persistence, recovery after restart.
 */

import type { BookingAuditEntry, BookingExecutionSession, UnifiedBooking } from './types'
import type { ReservationRecord } from './types'

export type PersistedBookingExecutionState = {
  sessions: BookingExecutionSession[]
  bookings: UnifiedBooking[]
  reservations: ReservationRecord[]
  audit: BookingAuditEntry[]
  idempotencyIndex: Array<[string, string]>
}

export class BookingSessionStore {
  private readonly sessions = new Map<string, BookingExecutionSession>()
  private readonly bookings = new Map<string, UnifiedBooking>()
  private readonly idempotency = new Map<string, string>()

  save(session: BookingExecutionSession): void {
    this.sessions.set(session.id, structuredClone(session))
    this.idempotency.set(session.idempotencyKey, session.id)
    for (const booking of session.bookings) {
      this.bookings.set(booking.id, structuredClone(booking))
    }
  }

  get(sessionId: string): BookingExecutionSession | undefined {
    const session = this.sessions.get(sessionId)
    return session ? structuredClone(session) : undefined
  }

  getByIdempotencyKey(key: string): BookingExecutionSession | undefined {
    const id = this.idempotency.get(key)
    return id ? this.get(id) : undefined
  }

  getBooking(bookingId: string): UnifiedBooking | undefined {
    const booking = this.bookings.get(bookingId)
    return booking ? structuredClone(booking) : undefined
  }

  list(): BookingExecutionSession[] {
    return [...this.sessions.values()].map((s) => structuredClone(s))
  }

  /** Serialize for restart recovery. */
  persist(extra?: {
    reservations?: ReservationRecord[]
    audit?: BookingAuditEntry[]
  }): PersistedBookingExecutionState {
    return {
      sessions: this.list(),
      bookings: [...this.bookings.values()].map((b) => structuredClone(b)),
      reservations: extra?.reservations ? structuredClone(extra.reservations) : [],
      audit: extra?.audit ? structuredClone(extra.audit) : [],
      idempotencyIndex: [...this.idempotency.entries()],
    }
  }

  /** Restore after process restart. */
  recover(state: PersistedBookingExecutionState): void {
    this.sessions.clear()
    this.bookings.clear()
    this.idempotency.clear()
    for (const session of state.sessions) this.sessions.set(session.id, structuredClone(session))
    for (const booking of state.bookings) this.bookings.set(booking.id, structuredClone(booking))
    for (const [key, sessionId] of state.idempotencyIndex) {
      this.idempotency.set(key, sessionId)
    }
  }

  clear(): void {
    this.sessions.clear()
    this.bookings.clear()
    this.idempotency.clear()
  }
}

let defaultStore: BookingSessionStore | null = null

export function getDefaultBookingSessionStore(): BookingSessionStore {
  if (!defaultStore) defaultStore = new BookingSessionStore()
  return defaultStore
}

export function resetDefaultBookingSessionStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
