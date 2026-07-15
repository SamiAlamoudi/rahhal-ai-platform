/**
 * BookingHistory / payment & ticket views — provider-blind summaries with masking.
 */

import type { BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { NotificationSession } from '../notifications/types'
import type { ConfirmationDocument, TicketSession } from '../ticketing/types'
import { buildConfirmationDocument } from '../ticketing/confirmationDocuments'
import { maskEmail } from './privacy'
import type {
  BookingHistoryEntry,
  NotificationHistoryEntry,
  PaymentHistoryEntry,
  TicketViewEntry,
} from './types'

export function toBookingHistoryEntry(session: BookingSession): BookingHistoryEntry {
  return {
    bookingSessionId: session.id,
    status: session.status,
    total: session.total,
    currency: session.currency,
    itemCount: session.items.length,
    itemTitles: session.items.map((i) => i.title),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    confirmedAt: session.confirmedAt,
  }
}

export function toPaymentHistoryEntry(
  order: RahhalOrder,
  customerEmail?: string | null,
): PaymentHistoryEntry {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentSessionId: order.paymentSessionId,
    status: order.status,
    amount: order.cart.total,
    currency: order.cart.currency,
    customerEmailMasked: maskEmail(customerEmail ?? null),
    paidAt: order.paidAt,
    createdAt: order.createdAt,
  }
}

export function toTicketViewEntry(session: TicketSession): TicketViewEntry {
  const hotels = session.lines.filter((l) => l.kind === 'hotel')
  return {
    ticketSessionId: session.id,
    status: session.status,
    confirmationNumber: session.confirmationNumber,
    bookingReference: session.bookingReference,
    flightTitles: session.lines.filter((l) => l.kind === 'flight').map((l) => l.title),
    hotelTitles: hotels.map((l) => l.title),
    hotelVouchers: hotels.map((l) => ({
      title: l.title,
      hotelConfirmationNumber: l.hotelConfirmationNumber,
      checkIn: l.checkIn,
      checkOut: l.checkOut,
    })),
    issuedAt: session.issuedAt,
  }
}

export function toNotificationHistoryEntry(
  session: NotificationSession,
): NotificationHistoryEntry {
  return {
    sessionId: session.id,
    eventType: session.eventType,
    status: session.status,
    channels: [...session.channels],
    subject: session.content.subject,
    createdAt: session.createdAt,
    deliveredAt: session.deliveredAt,
  }
}

/** Downloadable confirmation document snapshot (mock — no binary file IO). */
export function downloadConfirmationDocument(
  ticket: TicketSession,
): ConfirmationDocument {
  return buildConfirmationDocument(ticket)
}

export class BookingHistory {
  listBookings(sessions: BookingSession[]): BookingHistoryEntry[] {
    return sessions
      .map(toBookingHistoryEntry)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  listPayments(orders: RahhalOrder[]): PaymentHistoryEntry[] {
    return orders
      .map((o) => toPaymentHistoryEntry(o))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  listTickets(tickets: TicketSession[]): TicketViewEntry[] {
    return tickets
      .map(toTicketViewEntry)
      .sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''))
  }

  listNotifications(sessions: NotificationSession[]): NotificationHistoryEntry[] {
    return sessions
      .map(toNotificationHistoryEntry)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}
