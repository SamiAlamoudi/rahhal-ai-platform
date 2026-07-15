/**
 * TripTimeline — chronological events from booking, payment, ticketing, notifications.
 */

import type { BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import type { NotificationSession } from '../notifications/types'
import type { TicketSession } from '../ticketing/types'
import { sanitizeAuditMetadata } from './privacy'
import type { ManagedTrip, TripTimelineEvent } from './types'

export interface TimelineSources {
  trip: ManagedTrip
  bookings?: BookingSession[]
  orders?: RahhalOrder[]
  payments?: PaymentSession[]
  tickets?: TicketSession[]
  notifications?: NotificationSession[]
}

function event(
  partial: Omit<TripTimelineEvent, 'metadata'> & { metadata?: Record<string, unknown> },
): TripTimelineEvent {
  return {
    ...partial,
    metadata: sanitizeAuditMetadata(partial.metadata),
  }
}

export function buildTripTimeline(sources: TimelineSources): TripTimelineEvent[] {
  const events: TripTimelineEvent[] = []
  const { trip } = sources

  for (const a of trip.audit) {
    events.push(event({
      id: `trip-${a.id}`,
      at: a.at,
      source: 'trip',
      type: a.type,
      message: a.message,
      relatedId: trip.id,
      status: a.toStatus,
      metadata: a.metadata,
    }))
  }

  for (const booking of sources.bookings ?? []) {
    events.push(event({
      id: `booking-created-${booking.id}`,
      at: booking.createdAt,
      source: 'booking',
      type: 'booking.created',
      message: `Booking session created (${booking.items.length} items)`,
      relatedId: booking.id,
      status: booking.status,
      metadata: { itemCount: booking.items.length, total: booking.total, currency: booking.currency },
    }))
    if (booking.confirmedAt) {
      events.push(event({
        id: `booking-confirmed-${booking.id}`,
        at: booking.confirmedAt,
        source: 'booking',
        type: 'booking.confirmed',
        message: 'Booking confirmed',
        relatedId: booking.id,
        status: booking.status,
      }))
    }
    if (booking.status === 'cancelled') {
      events.push(event({
        id: `booking-cancelled-${booking.id}`,
        at: booking.updatedAt,
        source: 'booking',
        type: 'booking.cancelled',
        message: 'Booking cancelled',
        relatedId: booking.id,
        status: booking.status,
      }))
    }
  }

  for (const order of sources.orders ?? []) {
    events.push(event({
      id: `payment-order-${order.id}`,
      at: order.createdAt,
      source: 'payment',
      type: 'payment.order_created',
      message: `Order ${order.orderNumber} created`,
      relatedId: order.id,
      status: order.status,
      metadata: { amount: order.cart.total, currency: order.cart.currency },
    }))
    if (order.paidAt) {
      events.push(event({
        id: `payment-paid-${order.id}`,
        at: order.paidAt,
        source: 'payment',
        type: 'payment.captured',
        message: `Payment captured for ${order.orderNumber}`,
        relatedId: order.paymentSessionId ?? order.id,
        status: order.status,
        metadata: { amount: order.cart.total, currency: order.cart.currency },
      }))
    }
  }

  for (const payment of sources.payments ?? []) {
    events.push(event({
      id: `payment-session-${payment.id}-${payment.status}`,
      at: payment.updatedAt || payment.createdAt,
      source: 'payment',
      type: `payment.${payment.status}`,
      message: `Payment session ${payment.status}`,
      relatedId: payment.id,
      status: payment.status,
      metadata: {
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
      },
    }))
  }

  for (const ticket of sources.tickets ?? []) {
    for (const a of ticket.audit) {
      events.push(event({
        id: `ticket-audit-${a.id}`,
        at: a.at,
        source: 'ticketing',
        type: a.type,
        message: a.message,
        relatedId: ticket.id,
        status: (a.toStatus as string | null) ?? ticket.status,
        metadata: a.metadata,
      }))
    }
    if (ticket.issuedAt) {
      events.push(event({
        id: `ticket-issued-${ticket.id}`,
        at: ticket.issuedAt,
        source: 'ticketing',
        type: 'ticketing.issued',
        message: `Tickets issued (${ticket.confirmationNumber ?? ticket.bookingReference})`,
        relatedId: ticket.id,
        status: ticket.status,
      }))
    }
  }

  for (const notification of sources.notifications ?? []) {
    for (const a of notification.audit) {
      events.push(event({
        id: `notif-audit-${a.id}`,
        at: a.at,
        source: 'notification',
        type: a.type,
        message: a.message,
        relatedId: notification.id,
        status: (a.toStatus as string | null) ?? notification.status,
        metadata: a.metadata,
      }))
    }
    if (notification.deliveredAt) {
      events.push(event({
        id: `notif-delivered-${notification.id}`,
        at: notification.deliveredAt,
        source: 'notification',
        type: 'notification.delivered',
        message: notification.content.subject,
        relatedId: notification.id,
        status: notification.status,
        metadata: { eventType: notification.eventType, channels: notification.channels },
      }))
    }
  }

  return events.sort((a, b) => {
    const cmp = a.at.localeCompare(b.at)
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
  })
}
