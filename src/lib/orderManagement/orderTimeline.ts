/**
 * Sprint 15 — Order lifecycle timeline (extends booking confirmation stages).
 * Supports future ticket issuance without duplicating BookingSession state.
 */

import type { ConfirmationState } from '../bookingConfirmation/types'
import type { ManagedOrder, OrderTimelineEvent, OrderTimelineEventType } from './types'

const LABELS: Record<OrderTimelineEventType, { en: string; ar: string }> = {
  booking_created: { en: 'Booking Created', ar: 'تم إنشاء الحجز' },
  booking_confirmed: { en: 'Booking Confirmed', ar: 'تم تأكيد الحجز' },
  order_created: { en: 'Order Created', ar: 'تم إنشاء الطلب' },
  awaiting_payment: { en: 'Awaiting Payment', ar: 'بانتظار الدفع' },
  paid: { en: 'Paid', ar: 'تم الدفع' },
  ticket_pending: { en: 'Ticket Pending', ar: 'التذكرة قيد الإصدار' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  payment_failed: { en: 'Payment Failed', ar: 'فشل الدفع' },
}

function event(
  type: OrderTimelineEventType,
  at: string,
  meta?: Record<string, unknown>,
): OrderTimelineEvent {
  const labels = LABELS[type]
  return {
    id: `${type}-${at}`,
    type,
    at,
    labelEn: labels.en,
    labelAr: labels.ar,
    meta,
  }
}

export function buildOrderTimeline(input: {
  order: ManagedOrder
  confirmation?: ConfirmationState | null
  /** When true, stop at ticket_pending instead of completed after paid. */
  ticketPending?: boolean
}): OrderTimelineEvent[] {
  const { order, confirmation } = input
  const ticketPending = input.ticketPending ?? confirmation?.ticketPending ?? true
  const bookingCreatedAt = confirmation?.pendingAt
    ?? confirmation?.events.find((e) => e.type === 'booking_created')?.at
    ?? order.createdAt
  const bookingConfirmedAt = confirmation?.confirmedAt ?? null

  const events: OrderTimelineEvent[] = [
    event('booking_created', bookingCreatedAt),
  ]

  if (bookingConfirmedAt || confirmation?.status === 'confirmed') {
    events.push(event('booking_confirmed', bookingConfirmedAt ?? order.createdAt))
  }

  events.push(event('order_created', order.createdAt, { orderId: order.orderId }))

  if (
    order.orderStatus === 'awaiting_payment'
    || order.orderStatus === 'paid'
    || order.orderStatus === 'confirmed'
    || order.orderStatus === 'payment_failed'
  ) {
    events.push(event('awaiting_payment', order.createdAt))
  }

  if (order.orderStatus === 'payment_failed') {
    events.push(event('payment_failed', order.updatedAt))
  }

  if (order.orderStatus === 'paid' || order.orderStatus === 'confirmed' || order.paidAt) {
    events.push(event('paid', order.paidAt ?? order.updatedAt))
    if (ticketPending && order.orderStatus !== 'confirmed') {
      events.push(event('ticket_pending', order.paidAt ?? order.updatedAt))
    } else if (order.orderStatus === 'confirmed' || !ticketPending) {
      if (ticketPending && order.orderStatus === 'confirmed') {
        events.push(event('ticket_pending', order.confirmedAt ?? order.updatedAt))
      }
      events.push(event('completed', order.confirmedAt ?? order.paidAt ?? order.updatedAt))
    }
  }

  if (order.orderStatus === 'cancelled') {
    events.push(event('cancelled', order.updatedAt))
  }

  return events.sort((a, b) => a.at.localeCompare(b.at))
}

export function orderTimelineLabels(): typeof LABELS {
  return LABELS
}

/** Active step highlight for BookingTimeline UI. */
export function activeOrderTimelineType(order: ManagedOrder): OrderTimelineEventType {
  switch (order.orderStatus) {
    case 'draft':
      return 'order_created'
    case 'awaiting_payment':
      return 'awaiting_payment'
    case 'payment_failed':
      return 'payment_failed'
    case 'paid':
      return 'paid'
    case 'confirmed':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'cancelled'
    default:
      return 'awaiting_payment'
  }
}
