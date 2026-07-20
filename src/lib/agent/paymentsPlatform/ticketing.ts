/**
 * Ticketing — Sprint 58.
 * Flights, hotel/activity vouchers, car confirmations, insurance certificates.
 */

import type { BookingExecutionResult, UnifiedBooking } from '../bookingExecution/types'
import type { TicketKind, UnifiedTicket } from './types'

function kindFromBooking(booking: UnifiedBooking): TicketKind {
  switch (booking.domain) {
    case 'flights':
      return 'flight'
    case 'hotels':
      return 'hotel_voucher'
    case 'activities':
      return 'activity_voucher'
    case 'car_rental':
      return 'car_rental'
    case 'insurance':
      return 'insurance_certificate'
    default:
      return 'activity_voucher'
  }
}

export function issueTicketsFromBookings(input: {
  paymentSessionId: string
  bookings: UnifiedBooking[]
  travelerName?: string
  now?: () => number
}): UnifiedTicket[] {
  const now = input.now ?? (() => Date.now())
  const at = new Date(now()).toISOString()
  return input.bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'ticketed')
    .map((booking) => {
      const kind = kindFromBooking(booking)
      const id = `tkt_${Math.random().toString(36).slice(2, 10)}`
      return {
        id,
        paymentSessionId: input.paymentSessionId,
        kind,
        bookingId: booking.id,
        confirmation: booking.confirmation,
        pnr: booking.pnr,
        title: `${booking.domain} — ${booking.provider}`,
        travelerName: input.travelerName
          ?? (booking.travelerInfo[0]
            ? `${booking.travelerInfo[0]?.firstName ?? ''} ${booking.travelerInfo[0]?.lastName ?? ''}`.trim()
            : 'Traveler'),
        issuedAt: at,
        status: 'issued' as const,
        documentIds: [],
        raw: { booking },
      }
    })
}

export function issueTicketsFromExecution(input: {
  paymentSessionId: string
  execution: BookingExecutionResult
  travelerName?: string
  now?: () => number
}): UnifiedTicket[] {
  return issueTicketsFromBookings({
    paymentSessionId: input.paymentSessionId,
    bookings: input.execution.bookings,
    travelerName: input.travelerName,
    now: input.now,
  })
}
