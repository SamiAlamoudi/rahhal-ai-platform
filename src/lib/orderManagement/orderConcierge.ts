/**
 * Concierge helpers for order / payment questions (Sprint 15).
 */

import { formatMoney } from '../payment/money'
import type { ManagedOrder } from './types'
import { MANAGED_ORDER_STATUS_LABELS, MANAGED_PAYMENT_STATUS_LABELS } from './types'
import {
  findManagedOrderBySessionId,
  listManagedOrdersForCustomer,
} from './orderFromBooking'
import { getActivePaymentSessionForOrder } from './paymentSessionManager'

export type OrderConciergeIntent =
  | 'how_much_will_i_pay'
  | 'is_order_ready'
  | 'show_checkout'
  | 'what_is_payment_status'

export function answerHowMuchWillIPay(order: ManagedOrder): string {
  const total = formatMoney(order.totalAmount, order.currency)
  return [
    `Your order **${order.orderId}** totals **${total}**.`,
    `Breakdown: base ${formatMoney(order.fareBreakdown.baseFare, order.currency)}, taxes ${formatMoney(order.fareBreakdown.taxes, order.currency)}, fees ${formatMoney(order.fareBreakdown.fees, order.currency)}.`,
    `Payment status: **${MANAGED_PAYMENT_STATUS_LABELS[order.paymentStatus]}**. Order status: **${MANAGED_ORDER_STATUS_LABELS[order.orderStatus]}**.`,
    order.checkoutPath ? `Review checkout: ${order.checkoutPath}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function answerIsOrderReady(order: ManagedOrder): string {
  const ready =
    order.orderStatus === 'awaiting_payment'
    || order.orderStatus === 'paid'
    || order.orderStatus === 'confirmed'

  if (ready) {
    return [
      `Yes — order **${order.orderId}** is ready.`,
      `Status: **${MANAGED_ORDER_STATUS_LABELS[order.orderStatus]}** · Payment: **${MANAGED_PAYMENT_STATUS_LABELS[order.paymentStatus]}**.`,
      `Booking reference: **${order.bookingReference}**.`,
      order.checkoutPath && order.orderStatus === 'awaiting_payment'
        ? `Continue to payment: ${order.checkoutPath}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (order.orderStatus === 'draft') {
    return `Order **${order.orderId}** is still a draft. Confirm your booking first, then complete checkout.`
  }

  if (order.orderStatus === 'payment_failed') {
    return `Order **${order.orderId}** is not ready for ticketing yet — payment failed. You can retry from checkout.`
  }

  if (order.orderStatus === 'cancelled') {
    return `Order **${order.orderId}** was cancelled.`
  }

  return `Order **${order.orderId}** status: **${MANAGED_ORDER_STATUS_LABELS[order.orderStatus]}**.`
}

export function answerShowCheckout(order: ManagedOrder): string {
  return [
    `## Checkout — ${order.orderId}`,
    `Booking: **${order.bookingReference}**`,
    `Route: ${order.itinerary?.summary ?? '—'}`,
    `Passengers: ${order.passengers.length}`,
    `Total: **${formatMoney(order.totalAmount, order.currency)}**`,
    `Status: ${MANAGED_ORDER_STATUS_LABELS[order.orderStatus]} · Payment: ${MANAGED_PAYMENT_STATUS_LABELS[order.paymentStatus]}`,
    order.checkoutPath ? `Open: ${order.checkoutPath}` : 'Checkout path unavailable.',
  ].join('\n')
}

export function answerPaymentStatus(order: ManagedOrder): string {
  const session = getActivePaymentSessionForOrder(order.orderId)
  const lines = [
    `Payment status for order **${order.orderId}**: **${MANAGED_PAYMENT_STATUS_LABELS[order.paymentStatus]}**.`,
    `Order status: **${MANAGED_ORDER_STATUS_LABELS[order.orderStatus]}**.`,
  ]
  if (session) {
    lines.push(
      `Active payment session: **${session.id}** (${session.status}).`,
      session.expiresAt ? `Expires: ${session.expiresAt}` : '',
    )
  } else {
    lines.push('No active payment session.')
  }
  return lines.filter(Boolean).join('\n')
}

export function buildOrderConciergeReply(
  intent: OrderConciergeIntent,
  opts: { bookingSessionId?: string; customerId?: string; order?: ManagedOrder | null },
): string {
  let order: ManagedOrder | null = opts.order ?? null
  if (!order && opts.bookingSessionId) {
    order = findManagedOrderBySessionId(opts.bookingSessionId)
  }
  if (!order && opts.customerId) {
    const list = listManagedOrdersForCustomer(opts.customerId)
    order = list[0] ?? null
  }
  if (!order) {
    return 'I could not find an order yet. Confirm a booking first, then ask again about payment or checkout.'
  }

  switch (intent) {
    case 'how_much_will_i_pay':
      return answerHowMuchWillIPay(order)
    case 'is_order_ready':
      return answerIsOrderReady(order)
    case 'show_checkout':
      return answerShowCheckout(order)
    case 'what_is_payment_status':
      return answerPaymentStatus(order)
  }
}
