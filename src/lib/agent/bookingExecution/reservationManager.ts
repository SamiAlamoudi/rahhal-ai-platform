/**
 * Reservation Manager — Sprint 57.
 * Persists reservation tokens, provider references, expiration, refresh.
 */

import type { BookingExecutionDomain, BookingLifecycleStatus, ReservationRecord } from './types'

export class ReservationManager {
  private readonly byId = new Map<string, ReservationRecord>()
  private readonly now: () => number

  constructor(options?: { now?: () => number }) {
    this.now = options?.now ?? (() => Date.now())
  }

  create(input: {
    bookingId: string
    providerId: string
    domain: BookingExecutionDomain
    token?: string
    providerReference?: string | null
    expiresInMs?: number
    status?: BookingLifecycleStatus
  }): ReservationRecord {
    const reservationId = `rsv_${Math.random().toString(36).slice(2, 10)}`
    const record: ReservationRecord = {
      reservationId,
      bookingId: input.bookingId,
      providerId: input.providerId,
      domain: input.domain,
      token: input.token ?? `tok_${reservationId}`,
      providerReference: input.providerReference ?? null,
      expiresAt: new Date(this.now() + (input.expiresInMs ?? 15 * 60_000)).toISOString(),
      refreshedAt: null,
      status: input.status ?? 'pending',
    }
    this.byId.set(reservationId, record)
    return record
  }

  get(reservationId: string): ReservationRecord | undefined {
    return this.byId.get(reservationId)
  }

  listByBooking(bookingId: string): ReservationRecord[] {
    return [...this.byId.values()].filter((r) => r.bookingId === bookingId)
  }

  refresh(reservationId: string, extendsMs = 15 * 60_000): ReservationRecord | null {
    const current = this.byId.get(reservationId)
    if (!current) return null
    if (this.isExpired(current)) return null
    const next: ReservationRecord = {
      ...current,
      expiresAt: new Date(this.now() + extendsMs).toISOString(),
      refreshedAt: new Date(this.now()).toISOString(),
      token: `tok_${reservationId}_${this.now()}`,
    }
    this.byId.set(reservationId, next)
    return next
  }

  setStatus(reservationId: string, status: BookingLifecycleStatus): ReservationRecord | null {
    const current = this.byId.get(reservationId)
    if (!current) return null
    const next = { ...current, status }
    this.byId.set(reservationId, next)
    return next
  }

  isExpired(record: ReservationRecord): boolean {
    return Date.parse(record.expiresAt) <= this.now()
  }

  expireDue(): ReservationRecord[] {
    const expired: ReservationRecord[] = []
    for (const [id, record] of this.byId) {
      if (
        this.isExpired(record)
        && record.status !== 'expired'
        && record.status !== 'cancelled'
        && record.status !== 'ticketed'
        && record.status !== 'confirmed'
      ) {
        const next = { ...record, status: 'expired' as const }
        this.byId.set(id, next)
        expired.push(next)
      }
    }
    return expired
  }

  hydrate(records: ReservationRecord[]): void {
    this.byId.clear()
    for (const record of records) this.byId.set(record.reservationId, record)
  }

  snapshot(): ReservationRecord[] {
    return [...this.byId.values()]
  }

  clear(): void {
    this.byId.clear()
  }
}
