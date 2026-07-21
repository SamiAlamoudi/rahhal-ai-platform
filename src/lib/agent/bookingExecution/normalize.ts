/**
 * Normalize provider booking responses into UnifiedBooking — Sprint 57 / 61.
 */

import type { BookingOrderPayload, MoneyAmount } from '../bookingIntelligence/types'
import type {
  BookingExecutionDomain,
  BookingLifecycleStatus,
  BookingTravelerInfo,
  UnifiedBooking,
} from './types'

export function normalizeProviderBooking(input: {
  sessionId: string
  conversationId?: string | null
  domain: BookingExecutionDomain
  providerId: string
  offerId: string
  confirmationId?: string | null
  reservationId?: string | null
  status: BookingLifecycleStatus
  travelers: BookingTravelerInfo[]
  pricing: MoneyAmount
  taxes?: MoneyAmount
  title?: string
  now?: () => number
  expiresAt?: string | null
  raw?: unknown
  order?: BookingOrderPayload | null
  checkIn?: string | null
  checkOut?: string | null
  roomType?: string | null
}): UnifiedBooking {
  const now = input.now ?? (() => Date.now())
  const at = new Date(now()).toISOString()
  const confirmation = input.confirmationId ?? input.order?.orderId ?? null
  const order = input.order
  const pnr =
    order?.pnr
    ?? (input.domain === 'flights' && confirmation
      ? confirmation.replace(/^sim-book-|^live-book-|^duffel-order-stub-|^amd-ord-/i, '').slice(0, 6).toUpperCase()
      : null)
  const ticketNumbers =
    order?.ticketNumbers?.length
      ? order.ticketNumbers
      : input.domain === 'flights' && confirmation
        ? [confirmation]
        : []
  const travelerInfo = (order?.travelerList?.length
    ? order.travelerList
    : input.travelers
  ).map((t) => ({
    firstName: t.firstName,
    lastName: t.lastName,
    email: 'email' in t ? t.email ?? null : null,
    phone: 'phone' in t ? t.phone ?? null : null,
  }))
  const guestNames =
    order?.guestNames?.length
      ? order.guestNames
      : travelerInfo.map((t) => `${t.firstName} ${t.lastName}`.trim())
  const pricing = order?.price
    ? { amount: order.price.amount, currency: order.price.currency }
    : { ...input.pricing }
  const hotelConfirmation =
    order?.hotelConfirmation
    ?? (input.domain === 'hotels' ? confirmation : null)

  return {
    id: `bkg_${Math.random().toString(36).slice(2, 10)}`,
    sessionId: input.sessionId,
    conversationId: input.conversationId ?? null,
    domain: input.domain,
    provider: input.providerId,
    confirmation,
    providerBookingId: order?.providerBookingId ?? confirmation,
    pnr,
    ticketNumbers,
    reservationId: input.reservationId ?? (input.domain === 'hotels' ? confirmation : null),
    hotelConfirmation,
    guestNames,
    roomType: order?.roomType ?? input.roomType ?? null,
    checkIn: order?.checkIn ?? input.checkIn ?? null,
    checkOut: order?.checkOut ?? input.checkOut ?? null,
    status: input.status,
    travelerInfo,
    pricing,
    taxes: input.taxes ?? {
      amount: Math.round(pricing.amount * 0.05),
      currency: pricing.currency,
    },
    tickets:
      input.domain === 'flights' && confirmation
        ? ticketNumbers.map((number, index) => ({
            id: `tkt_${confirmation}_${index}`,
            number,
            segmentLabel: input.title ?? null,
            issuedAt: input.status === 'ticketed' || input.status === 'confirmed' ? at : null,
          }))
        : [],
    documents:
      confirmation
        ? [
            {
              id: `doc_${confirmation}`,
              type: input.domain === 'flights' ? 'eticket' : 'voucher',
              url: null,
              label: `${input.domain} confirmation`,
            },
          ]
        : [],
    offerId: input.offerId,
    createdAt: order?.createdAt ?? at,
    updatedAt: at,
    expiresAt: input.expiresAt ?? null,
    raw: order ?? input.raw,
  }
}

export function withBookingStatus(
  booking: UnifiedBooking,
  status: BookingLifecycleStatus,
  now: () => number = () => Date.now(),
): UnifiedBooking {
  return {
    ...booking,
    status,
    updatedAt: new Date(now()).toISOString(),
    tickets:
      status === 'ticketed' || status === 'confirmed'
        ? booking.tickets.map((t) => ({
            ...t,
            issuedAt: t.issuedAt ?? new Date(now()).toISOString(),
          }))
        : booking.tickets,
  }
}

/** Sprint 61 flight normalize view. */
export function toFlightBookingView(booking: UnifiedBooking) {
  return {
    bookingId: booking.id,
    providerBookingId: booking.providerBookingId,
    pnr: booking.pnr,
    ticketNumbers: booking.ticketNumbers,
    travelerList: booking.travelerInfo.map((t) => ({
      firstName: t.firstName,
      lastName: t.lastName,
    })),
    status: booking.status,
    price: booking.pricing.amount,
    currency: booking.pricing.currency,
    createdAt: booking.createdAt,
  }
}

/** Sprint 61 hotel normalize view. */
export function toHotelBookingView(booking: UnifiedBooking) {
  return {
    reservationId: booking.reservationId ?? booking.id,
    hotelConfirmation: booking.hotelConfirmation,
    guestNames: booking.guestNames,
    roomType: booking.roomType,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    status: booking.status,
    totalPrice: booking.pricing.amount,
    currency: booking.pricing.currency,
  }
}
