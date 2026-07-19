/**
 * Checkout review projection for ManagedOrder (Sprint 15).
 */

import { formatMoney } from '../payment/money'
import type { ManagedOrder } from './types'
import { MANAGED_ORDER_STATUS_LABELS, MANAGED_PAYMENT_STATUS_LABELS } from './types'
import { answerShowCheckout } from './orderConcierge'

export interface CheckoutReviewModel {
  orderId: string
  orderNumber: string
  bookingReference: string
  flightSummary: string
  passengerLines: string[]
  baseFare: string
  taxes: string
  fees: string
  discount: string
  total: string
  currency: string
  orderStatusLabel: string
  paymentStatusLabel: string
  bookingConditions: string[]
  cancellationPolicy: string
  conciergeSummary: string
  checkoutPath: string
}

const DEFAULT_CONDITIONS = [
  'Fares are subject to airline rules and availability until payment is completed.',
  'Passenger names must match travel documents exactly.',
  'Taxes and fees are included in the displayed total unless noted otherwise.',
]

const CANCELLATION_PLACEHOLDER =
  'Cancellation policy will be confirmed after payment and ticket issuance. Changes and refunds follow airline fare rules.'

export function buildCheckoutReviewModel(order: ManagedOrder): CheckoutReviewModel {
  const itinerary = order.itinerary
  const flightSummary = itinerary
    ? [
        itinerary.summary,
        itinerary.airline,
        itinerary.cabin,
        itinerary.departureTime
          ? `Depart ${new Date(itinerary.departureTime).toLocaleString()}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : order.cart.items.map((i) => i.title).join(' · ') || '—'

  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    bookingReference: order.bookingReference,
    flightSummary,
    passengerLines: order.passengers.map(
      (p) => `${p.firstName} ${p.lastName} (${p.type})`,
    ),
    baseFare: formatMoney(order.fareBreakdown.baseFare, order.currency),
    taxes: formatMoney(order.fareBreakdown.taxes, order.currency),
    fees: formatMoney(order.fareBreakdown.fees, order.currency),
    discount: formatMoney(order.fareBreakdown.discount, order.currency),
    total: formatMoney(order.totalAmount, order.currency),
    currency: order.currency,
    orderStatusLabel: MANAGED_ORDER_STATUS_LABELS[order.orderStatus],
    paymentStatusLabel: MANAGED_PAYMENT_STATUS_LABELS[order.paymentStatus],
    bookingConditions: DEFAULT_CONDITIONS,
    cancellationPolicy: CANCELLATION_PLACEHOLDER,
    conciergeSummary: answerShowCheckout(order),
    checkoutPath: order.checkoutPath,
  }
}
