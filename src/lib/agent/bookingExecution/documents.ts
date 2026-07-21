/**
 * Sprint 61 — booking documents via existing DocumentCenter / ticketing.
 * No second document system for the legacy path.
 * Sprint 63 — when ai.document_center_v2 is ON, also publish to Enterprise Document Center.
 */

import { DocumentCenter } from '../paymentsPlatform/documents'
import { issueTicketsFromBookings } from '../paymentsPlatform/ticketing'
import type { DocumentRecord, UnifiedTicket } from '../paymentsPlatform/types'
import { publishDocumentsAfterBookingExecution } from '../documentCenter'
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
  /** Optional trip id for Enterprise Document Center linkage (Sprint 63). */
  tripId?: string | null
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

  // Sprint 63 — auto-publish into Enterprise Document Center when flag enabled (no-op when OFF).
  publishDocumentsAfterBookingExecution({
    sessionId: input.sessionId,
    bookings: input.bookings,
    tripId: input.tripId ?? null,
    now: input.now,
  })

  return {
    tickets,
    documents,
    eticket: documents.find((d) => d.kind === 'eticket') ?? null,
    voucher: documents.find((d) => d.kind === 'voucher') ?? null,
    invoice: documents.find((d) => d.kind === 'invoice') ?? null,
    summary,
  }
}
