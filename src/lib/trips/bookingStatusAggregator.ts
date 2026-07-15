/**
 * BookingStatusAggregator — provider-blind rollup of booking / payment / ticket state.
 */

import type { BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import type { TicketSession } from '../ticketing/types'
import type { AggregatedBookingStatus, ManagedTrip } from './types'

const ACTIVE_BOOKING = new Set([
  'draft',
  'selected',
  'ready_to_redirect',
  'redirected',
  'pending_provider_confirmation',
  'confirmed',
])

export interface AggregateInput {
  trip: ManagedTrip
  booking?: BookingSession | null
  order?: RahhalOrder | null
  payment?: PaymentSession | null
  ticket?: TicketSession | null
}

export function aggregateBookingStatus(input: AggregateInput): AggregatedBookingStatus {
  const booking = input.booking ?? null
  const order = input.order ?? null
  const payment = input.payment ?? null
  const ticket = input.ticket ?? null

  const bookingStatus = booking?.status ?? input.trip.summary.primaryBookingStatus
  const paymentStatus = payment?.status
    ?? (order?.status === 'paid' || order?.status === 'confirmed' ? 'paid' : order?.status)
    ?? input.trip.summary.primaryPaymentStatus
  const ticketStatus = ticket?.status ?? input.trip.summary.primaryTicketStatus

  const cancelled = bookingStatus === 'cancelled'
    || order?.status === 'cancelled'
    || input.trip.status === 'cancelled'
  const paid = paymentStatus === 'paid'
    || order?.status === 'paid'
    || order?.status === 'confirmed'
  const ticketed = ticketStatus === 'issued' || ticketStatus === 'delivered'
  const active = !cancelled
    && !input.trip.archived
    && (
      (bookingStatus != null && ACTIVE_BOOKING.has(bookingStatus))
      || paid
      || input.trip.status === 'upcoming'
      || input.trip.status === 'active'
    )

  return {
    bookingSessionId: booking?.id ?? input.trip.links.bookingSessionIds[0] ?? null,
    bookingStatus: bookingStatus ?? null,
    orderId: order?.id ?? input.trip.links.orderIds[0] ?? null,
    orderStatus: order?.status ?? null,
    paymentSessionId: payment?.id ?? order?.paymentSessionId ?? input.trip.links.paymentSessionIds[0] ?? null,
    paymentStatus: paymentStatus ?? null,
    ticketSessionId: ticket?.id ?? input.trip.links.ticketSessionIds[0] ?? null,
    ticketStatus: ticketStatus ?? null,
    active,
    cancelled,
    paid,
    ticketed,
  }
}

export function deriveManagedTripStatus(input: {
  archived: boolean
  cancelled: boolean
  endDate: string | null
  startDate: string | null
  paid: boolean
  bookingStatus: string | null
}): ManagedTrip['status'] {
  if (input.archived) return 'archived'
  if (input.cancelled || input.bookingStatus === 'cancelled') return 'cancelled'

  const now = Date.now()
  const start = input.startDate ? Date.parse(input.startDate) : NaN
  const end = input.endDate ? Date.parse(input.endDate) : NaN

  if (Number.isFinite(end) && end < now) return 'completed'
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end >= now)) {
    return 'active'
  }
  if (input.paid || input.bookingStatus === 'confirmed') return 'upcoming'
  return 'draft'
}
