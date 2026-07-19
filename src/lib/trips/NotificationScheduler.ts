/**
 * Sprint 35 — NotificationScheduler.
 * Channel abstraction: push / email / WhatsApp / SMS.
 * Complements Phase U NotificationOrchestrator; does not replace it.
 */

import type {
  ScheduledTripNotification,
  TripNotificationChannel,
  TripNotificationTrigger,
} from './postBookingTypes'

export interface NotificationDispatchResult {
  notificationId: string
  channel: TripNotificationChannel
  delivered: boolean
  at: string
}

export interface TripNotificationChannelAdapter {
  readonly channel: TripNotificationChannel
  send(input: {
    title: string
    body: string
    userId: string
    tripId: string
  }): Promise<{ delivered: boolean }>
}

function createMockChannel(channel: TripNotificationChannel): TripNotificationChannelAdapter {
  return {
    channel,
    async send() {
      return { delivered: true }
    },
  }
}

const TRIGGER_COPY: Record<
  TripNotificationTrigger,
  { title: string; body: (ctx: { destination: string; bookingReference: string }) => string }
> = {
  booking_confirmed: {
    title: 'Booking confirmed',
    body: (c) => `Your trip to ${c.destination} is confirmed (${c.bookingReference}).`,
  },
  payment_received: {
    title: 'Payment received',
    body: (c) => `Payment received for booking ${c.bookingReference}.`,
  },
  check_in_reminder: {
    title: 'Check-in reminder',
    body: (c) => `Online check-in is open for your trip to ${c.destination}.`,
  },
  gate_change: {
    title: 'Gate change',
    body: (c) => `Gate update for your flight on trip ${c.bookingReference}.`,
  },
  flight_delay: {
    title: 'Flight delay',
    body: (c) => `Your flight for ${c.destination} is delayed. Check the app for details.`,
  },
  boarding_reminder: {
    title: 'Boarding reminder',
    body: (c) => `Boarding starts soon for your flight to ${c.destination}.`,
  },
  hotel_check_in_reminder: {
    title: 'Hotel check-in reminder',
    body: (c) => `Hotel check-in reminder for ${c.destination}.`,
  },
  trip_completed: {
    title: 'Trip completed',
    body: (c) => `Hope you enjoyed ${c.destination}! Your trip is marked completed.`,
  },
}

export class NotificationScheduler {
  private readonly adapters: Map<TripNotificationChannel, TripNotificationChannelAdapter>
  private readonly queue: ScheduledTripNotification[] = []

  constructor(adapters?: TripNotificationChannelAdapter[]) {
    const list = adapters ?? [
      createMockChannel('push'),
      createMockChannel('email'),
      createMockChannel('whatsapp'),
      createMockChannel('sms'),
    ]
    this.adapters = new Map(list.map((a) => [a.channel, a]))
  }

  schedule(input: {
    tripId: string
    userId: string
    trigger: TripNotificationTrigger
    destination: string
    bookingReference: string
    channels?: TripNotificationChannel[]
    scheduledFor?: string
  }): ScheduledTripNotification {
    const copy = TRIGGER_COPY[input.trigger]
    const notification: ScheduledTripNotification = {
      notificationId: `tn_${Math.random().toString(36).slice(2, 10)}`,
      tripId: input.tripId,
      trigger: input.trigger,
      channels: input.channels ?? ['push', 'email'],
      scheduledFor: input.scheduledFor ?? new Date().toISOString(),
      sentAt: null,
      status: 'scheduled',
      title: copy.title,
      body: copy.body({
        destination: input.destination,
        bookingReference: input.bookingReference,
      }),
    }
    this.queue.push(notification)
    return { ...notification, channels: [...notification.channels] }
  }

  async dispatch(notificationId: string, userId: string): Promise<NotificationDispatchResult[]> {
    const notification = this.queue.find((n) => n.notificationId === notificationId)
    if (!notification) return []

    const results: NotificationDispatchResult[] = []
    for (const channel of notification.channels) {
      const adapter = this.adapters.get(channel)
      if (!adapter) {
        results.push({
          notificationId,
          channel,
          delivered: false,
          at: new Date().toISOString(),
        })
        continue
      }
      const sent = await adapter.send({
        title: notification.title,
        body: notification.body,
        userId,
        tripId: notification.tripId,
      })
      results.push({
        notificationId,
        channel,
        delivered: sent.delivered,
        at: new Date().toISOString(),
      })
    }

    notification.status = results.every((r) => r.delivered) ? 'sent' : 'failed'
    notification.sentAt = new Date().toISOString()
    return results
  }

  listForTrip(tripId: string): ScheduledTripNotification[] {
    return this.queue
      .filter((n) => n.tripId === tripId)
      .map((n) => ({ ...n, channels: [...n.channels] }))
  }

  supportedChannels(): TripNotificationChannel[] {
    return [...this.adapters.keys()]
  }
}

export function createNotificationScheduler(
  adapters?: TripNotificationChannelAdapter[],
): NotificationScheduler {
  return new NotificationScheduler(adapters)
}
