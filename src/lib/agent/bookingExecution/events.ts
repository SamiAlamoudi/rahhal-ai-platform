/**
 * Booking notification events — Sprint 57.
 */

import type { BookingNotificationEvent, BookingNotificationEventType } from './types'

export type BookingEventListener = (event: BookingNotificationEvent) => void

export class BookingEventBus {
  private readonly listeners = new Map<
    BookingNotificationEventType | '*',
    Set<BookingEventListener>
  >()

  on(type: BookingNotificationEventType | '*', listener: BookingEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: BookingNotificationEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) for (const l of specific) l(event)
    const all = this.listeners.get('*')
    if (all) for (const l of all) l(event)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createBookingEvent(
  type: BookingNotificationEventType,
  sessionId: string,
  bookingId: string | null = null,
  data?: Record<string, unknown>,
  now: () => number = () => Date.now(),
): BookingNotificationEvent {
  return {
    type,
    sessionId,
    bookingId,
    at: new Date(now()).toISOString(),
    data,
  }
}
