/**
 * Sprint 42 — live conversation notifications from Sprint 35 NotificationScheduler events.
 * In-process pub/sub for chat chrome; no new notification engine.
 */

import type { TripNotificationTrigger } from '../../trips/postBookingTypes'

export type ConversationLiveEventKind =
  | 'flight_delayed'
  | 'gate_changed'
  | 'hotel_cancelled'
  | 'refund_processed'
  | 'supplier_confirmed'
  | 'visa_approved'
  | 'documents_issued'
  | 'generic'

export interface ConversationLiveEvent {
  id: string
  kind: ConversationLiveEventKind
  title: string
  body: string
  tripId?: string
  at: string
  unread: boolean
}

type Listener = (events: ConversationLiveEvent[]) => void

const TRIGGER_TO_KIND: Partial<Record<TripNotificationTrigger, ConversationLiveEventKind>> = {
  flight_delay: 'flight_delayed',
  gate_change: 'gate_changed',
  booking_confirmed: 'supplier_confirmed',
  payment_received: 'supplier_confirmed',
  trip_completed: 'documents_issued',
}

export class ConversationLiveNotificationBus {
  private events: ConversationLiveEvent[] = []
  private listeners = new Set<Listener>()

  publish(event: Omit<ConversationLiveEvent, 'id' | 'at' | 'unread'> & {
    id?: string
    at?: string
    unread?: boolean
  }): ConversationLiveEvent {
    const row: ConversationLiveEvent = {
      id: event.id ?? `live_${Math.random().toString(36).slice(2, 10)}`,
      kind: event.kind,
      title: event.title,
      body: event.body,
      tripId: event.tripId,
      at: event.at ?? new Date().toISOString(),
      unread: event.unread ?? true,
    }
    this.events = [row, ...this.events].slice(0, 50)
    this.emit()
    return row
  }

  publishFromTrigger(input: {
    trigger: TripNotificationTrigger
    title: string
    body: string
    tripId?: string
  }): ConversationLiveEvent {
    return this.publish({
      kind: TRIGGER_TO_KIND[input.trigger] ?? 'generic',
      title: input.title,
      body: input.body,
      tripId: input.tripId,
    })
  }

  list(): ConversationLiveEvent[] {
    return [...this.events]
  }

  markRead(id: string): void {
    this.events = this.events.map((e) => (e.id === id ? { ...e, unread: false } : e))
    this.emit()
  }

  markAllRead(): void {
    this.events = this.events.map((e) => ({ ...e, unread: false }))
    this.emit()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.list())
    return () => {
      this.listeners.delete(listener)
    }
  }

  clear(): void {
    this.events = []
    this.emit()
  }

  private emit(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) listener(snapshot)
  }
}

let bus: ConversationLiveNotificationBus | null = null

export function getConversationLiveNotificationBus(): ConversationLiveNotificationBus {
  if (!bus) bus = new ConversationLiveNotificationBus()
  return bus
}

export function resetConversationLiveNotificationBus(): void {
  bus?.clear()
  bus = null
}
