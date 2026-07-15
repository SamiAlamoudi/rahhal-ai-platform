/**
 * Booking ↔ Payment ↔ Ticketing bridge (library-level).
 *
 * Ticketing may start only when booking is eligible and payment is captured
 * (paid) or approved by the mock flow. Does not change TripPlan or UI APIs.
 */

import type { BookingItem, BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import { maskEmail, maskPassport } from './privacy'
import type {
  FlightSegmentDetail,
  HotelRoomDetail,
  PaymentSummaryForTicket,
  TicketLineItem,
  TicketTraveler,
} from './types'

export interface TicketingEligibilityInput {
  bookingSession: BookingSession
  order: RahhalOrder
  paymentSession: PaymentSession | null
}

export interface TicketingEligibilityResult {
  eligible: boolean
  reason: string | null
  issuanceKey: string
}

export function assessTicketingEligibility(
  input: TicketingEligibilityInput,
): TicketingEligibilityResult {
  const { bookingSession, order, paymentSession } = input
  const issuanceKey = `${bookingSession.id}:${order.id}`

  if (!bookingSession.items.length) {
    return { eligible: false, reason: 'Booking session has no items', issuanceKey }
  }

  if (bookingSession.status === 'cancelled' || bookingSession.status === 'expired') {
    return { eligible: false, reason: `Booking status ${bookingSession.status} is not eligible`, issuanceKey }
  }

  const paymentOk = paymentSession?.status === 'paid'
    || order.status === 'paid'
    || order.status === 'confirmed'
  if (!paymentOk) {
    return {
      eligible: false,
      reason: `Payment not captured/approved (payment=${paymentSession?.status ?? 'none'}, order=${order.status})`,
      issuanceKey,
    }
  }

  if (order.id !== (paymentSession?.orderId ?? order.id)) {
    return { eligible: false, reason: 'Order / payment session mismatch', issuanceKey }
  }

  return { eligible: true, reason: null, issuanceKey }
}

export function buildPaymentSummary(
  order: RahhalOrder,
  paymentSession: PaymentSession | null,
): PaymentSummaryForTicket {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentSessionId: paymentSession?.id ?? order.paymentSessionId,
    amount: order.cart.total,
    currency: order.cart.currency,
    status: paymentSession?.status ?? order.status,
    paidAt: paymentSession?.paidAt ?? order.paidAt,
    customerEmailMasked: maskEmail(paymentSession?.customerEmail ?? null),
  }
}

export function buildTravelersFromOrder(order: RahhalOrder): TicketTraveler[] {
  if (order.travelers.length) {
    return order.travelers.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      type: t.type,
      passportMasked: maskPassport(t.passportNumber),
      nationality: t.nationality,
    }))
  }
  return [{
    id: 'traveler-1',
    firstName: 'Guest',
    lastName: 'Traveler',
    type: 'adult',
    passportMasked: null,
    nationality: null,
  }]
}

export function bookingItemsToTicketLines(
  items: BookingItem[],
  travelers: TicketTraveler[],
  now: string,
): TicketLineItem[] {
  return items
    .filter((item) => item.type === 'flight' || item.type === 'hotel')
    .map((item) => {
      const kind = item.type === 'hotel' ? 'hotel' as const : 'flight' as const
      const meta = item.metadata ?? {}
      return {
        id: `line_${item.id}`,
        kind,
        bookingItemId: item.id,
        status: 'pending' as const,
        title: item.title,
        providerId: item.providerId,
        providerBookingReference: null,
        airlinePnr: null,
        hotelConfirmationNumber: null,
        travelers,
        flightSegments: kind === 'flight' ? segmentsFromBookingItem(item) : [],
        hotelRooms: kind === 'hotel' ? roomsFromBookingItem(item, travelers.length) : [],
        hotelName: kind === 'hotel' ? String(meta.hotelName ?? item.title) : null,
        hotelAddress: kind === 'hotel'
          ? (typeof meta.address === 'string' ? meta.address : typeof meta.area === 'string' ? meta.area : null)
          : null,
        checkIn: kind === 'hotel' && typeof meta.checkIn === 'string' ? meta.checkIn : null,
        checkOut: kind === 'hotel' && typeof meta.checkOut === 'string' ? meta.checkOut : null,
        error: null,
        issuedAt: null,
        updatedAt: now,
        attemptCount: 0,
      }
    })
}

function segmentsFromBookingItem(item: BookingItem): FlightSegmentDetail[] {
  const meta = item.metadata ?? {}
  if (Array.isArray(meta.segments)) {
    return (meta.segments as Array<Record<string, unknown>>).map((seg, index) => ({
      segmentNumber: index + 1,
      airline: String(seg.airline ?? seg.carrier ?? 'Airline'),
      flightNumber: String(seg.flightNumber ?? seg.number ?? 'XX000'),
      from: String(seg.from ?? seg.origin ?? 'XXX'),
      to: String(seg.to ?? seg.destination ?? 'YYY'),
      departureAt: typeof seg.departureAt === 'string' ? seg.departureAt : null,
      arrivalAt: typeof seg.arrivalAt === 'string' ? seg.arrivalAt : null,
      cabin: typeof seg.cabin === 'string' ? seg.cabin : 'economy',
      baggage: typeof seg.baggage === 'string' ? seg.baggage : null,
    }))
  }
  // Title fallback: "Airline XYZ: RUH → HND"
  const arrow = item.title.split(/→|->/).map((p) => p.trim())
  const from = arrow[0]?.slice(-3)?.toUpperCase() || 'RUH'
  const to = arrow[1]?.slice(0, 3)?.toUpperCase() || 'XXX'
  return [{
    segmentNumber: 1,
    airline: item.providerName || 'Airline',
    flightNumber: typeof meta.flightNumber === 'string' ? meta.flightNumber : 'XX100',
    from,
    to,
    departureAt: typeof meta.departureAt === 'string' ? meta.departureAt : null,
    arrivalAt: typeof meta.arrivalAt === 'string' ? meta.arrivalAt : null,
    cabin: typeof meta.cabin === 'string' ? meta.cabin : 'economy',
    baggage: typeof meta.baggage === 'string' ? meta.baggage : null,
  }]
}

function roomsFromBookingItem(item: BookingItem, guests: number): HotelRoomDetail[] {
  const meta = item.metadata ?? {}
  const roomCount = typeof meta.rooms === 'number' && meta.rooms > 0 ? Math.floor(meta.rooms) : 1
  return Array.from({ length: roomCount }, (_, index) => ({
    roomIndex: index + 1,
    roomType: typeof meta.roomType === 'string' ? meta.roomType : 'Standard Room',
    board: typeof meta.board === 'string' ? meta.board : null,
    guests: Math.max(1, Math.ceil(guests / roomCount)),
  }))
}
