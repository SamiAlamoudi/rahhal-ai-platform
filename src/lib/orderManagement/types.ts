/**
 * Sprint 15 — Order Management domain (provider-independent).
 * Orders reference BookingSession; BookingSession remains SoT.
 */

import type { OrderStatus, TravelerInfo, CheckoutCart } from '../payment/checkoutTypes'
import type { PaymentSessionStatus } from '../payment/paymentTypes'

/** Product-facing order statuses (map onto Rahhal OrderStatus). */
export type ManagedOrderStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'payment_failed'
  | 'confirmed'
  | 'cancelled'
  | 'refunded'

export type ManagedPaymentStatus =
  | 'not_started'
  | 'awaiting_payment'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded'

/** Display labels matching Sprint 15 product language. */
export const MANAGED_ORDER_STATUS_LABELS: Record<ManagedOrderStatus, string> = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
  payment_failed: 'Payment Failed',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const MANAGED_PAYMENT_STATUS_LABELS: Record<ManagedPaymentStatus, string> = {
  not_started: 'Not Started',
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export interface OrderItinerarySummary {
  title: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  airline: string
  cabin: string
  summary: string
}

export interface OrderFareBreakdown {
  baseFare: number
  taxes: number
  fees: number
  discount: number
  total: number
}

export type OrderTimelineEventType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'order_created'
  | 'awaiting_payment'
  | 'paid'
  | 'ticket_pending'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'

export interface OrderTimelineEvent {
  id: string
  type: OrderTimelineEventType
  at: string
  labelEn: string
  labelAr: string
  meta?: Record<string, unknown>
}

export interface ManagedOrder {
  orderId: string
  orderNumber: string
  bookingReference: string
  bookingSessionId: string | null
  customerId: string
  passengers: TravelerInfo[]
  itinerary: OrderItinerarySummary | null
  fareBreakdown: OrderFareBreakdown
  totalAmount: number
  currency: string
  orderStatus: ManagedOrderStatus
  paymentStatus: ManagedPaymentStatus
  /** Underlying Rahhal order status. */
  rawOrderStatus: OrderStatus
  paymentSessionId: string | null
  cart: CheckoutCart
  checkoutPath: string
  createdAt: string
  updatedAt: string
  paidAt: string | null
  confirmedAt: string | null
}

export interface CreateOrderFromBookingInput {
  bookingSessionId: string
  userId: string
  /** Force create even if an order already exists for this booking (default: reuse). */
  forceNew?: boolean
}

export interface CreateOrderFromBookingResult {
  order: ManagedOrder
  created: boolean
}

export function mapOrderStatus(status: OrderStatus): ManagedOrderStatus {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'created':
    case 'pending_payment':
      return 'awaiting_payment'
    case 'paid':
      return 'paid'
    case 'failed':
      return 'payment_failed'
    case 'confirmed':
      return 'confirmed'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
    default:
      return 'awaiting_payment'
  }
}

/** Alias used by barrel / docs. */
export const toManagedOrderStatus = mapOrderStatus

export function mapPaymentStatus(
  orderStatus: OrderStatus,
  paymentSessionStatus?: PaymentSessionStatus | null,
): ManagedPaymentStatus {
  if (paymentSessionStatus === 'paid' || orderStatus === 'paid' || orderStatus === 'confirmed') {
    return 'paid'
  }
  if (paymentSessionStatus === 'failed' || orderStatus === 'failed') return 'failed'
  if (paymentSessionStatus === 'expired') return 'expired'
  if (paymentSessionStatus === 'cancelled' || orderStatus === 'cancelled') return 'cancelled'
  if (paymentSessionStatus === 'refunded' || orderStatus === 'refunded') return 'refunded'
  if (
    orderStatus === 'pending_payment'
    || paymentSessionStatus === 'pending'
    || paymentSessionStatus === 'created'
  ) {
    return 'awaiting_payment'
  }
  return 'not_started'
}

/** Alias used by barrel / docs. */
export const toManagedPaymentStatus = mapPaymentStatus

export function managedStatusToOrderStatus(status: ManagedOrderStatus): OrderStatus {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'awaiting_payment':
      return 'pending_payment'
    case 'paid':
      return 'paid'
    case 'payment_failed':
      return 'failed'
    case 'confirmed':
      return 'confirmed'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
  }
}

export function orderCheckoutPath(orderId: string): string {
  return `/checkout/order/${encodeURIComponent(orderId)}`
}
