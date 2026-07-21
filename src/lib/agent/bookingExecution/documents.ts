/**
 * Sprint 61 — booking documents via existing DocumentCenter / ticketing.
 * No second document system.
 */

import { DocumentCenter } from '../paymentsPlatform/documents'
import { issueTicketsFromBookings } from '../paymentsPlatform/ticketing'
import type { DocumentRecord, UnifiedTicket } from '../paymentsPlatform/types'
import type { UnifiedBooking } from './types'

export type BookingDocumentBundle = {
  tickets: UnifiedTicket[]
  documents: DocumentRecord[]
  eticket: DocumentRecord | null
  voucher: DocumentRecord | null
  invoice: DocumentRecord | null
  summary: DocumentRecord | null
}

let sharedCenter: DocumentCenter | null = null

export function getBookingDocumentCenter(): DocumentCenter {
  if (!sharedCenter) sharedCenter = new DocumentCenter()
  return sharedCenter
}

export function resetBookingDocumentCenter(): void {
  sharedCenter?.clear()
  sharedCenter = null
}

export function generateBookingDocuments(input: {
  sessionId: string
  bookings: UnifiedBooking[]
  travelerName?: string
  now?: () => number
  documents?: DocumentCenter
}): BookingDocumentBundle {
  const center = input.documents ?? getBookingDocumentCenter()
  const paymentSessionId = `exec_${input.sessionId}`
  const tickets = issueTicketsFromBookings({
    paymentSessionId,
    bookings: input.bookings,
    travelerName: input.travelerName,
    now: input.now,
  })
  const total = input.bookings.reduce((sum, b) => sum + (b.pricing.amount || 0), 0)
  const currency = input.bookings[0]?.pricing.currency || 'SAR'
  const documents = center.storeTicketBundle({
    paymentSessionId,
    tickets,
    invoiceAmount: total,
    currency,
    now: input.now,
  })
  // Explicit booking summary document (reuse DocumentCenter.store).
  const summary = center.store({
    paymentSessionId,
    kind: 'confirmation_pdf',
    label: 'Booking summary',
    meta: {
      sessionId: input.sessionId,
      bookingIds: input.bookings.map((b) => b.id),
      domains: input.bookings.map((b) => b.domain),
    },
    now: input.now,
  })
  documents.push(summary)

  return {
    tickets,
    documents,
    eticket: documents.find((d) => d.kind === 'eticket') ?? null,
    voucher: documents.find((d) => d.kind === 'voucher') ?? null,
    invoice: documents.find((d) => d.kind === 'invoice') ?? null,
    summary,
  }
}
