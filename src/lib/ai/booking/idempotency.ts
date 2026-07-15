/**
 * Phase AE — booking-scoped idempotency store (deterministic, in-memory).
 */

import type { Booking } from './models'

export class BookingIdempotencyStore {
  private readonly keys = new Map<string, string>()
  private readonly bookings = new Map<string, Booking>()

  remember(idempotencyKey: string, booking: Booking): void {
    this.keys.set(idempotencyKey, booking.id)
    this.bookings.set(booking.id, structuredClone(booking))
  }

  getByKey(idempotencyKey: string): Booking | null {
    const id = this.keys.get(idempotencyKey)
    if (!id) return null
    const booking = this.bookings.get(id)
    return booking ? structuredClone(booking) : null
  }

  getById(id: string): Booking | null {
    const booking = this.bookings.get(id)
    return booking ? structuredClone(booking) : null
  }

  save(booking: Booking): void {
    this.bookings.set(booking.id, structuredClone(booking))
    this.keys.set(booking.idempotencyKey, booking.id)
  }

  clear(): void {
    this.keys.clear()
    this.bookings.clear()
  }
}
