/**
 * Build ConfirmationDocument records from an issued TicketSession.
 */

import type { ConfirmationDocument, TicketSession } from './types'

const SUPPORT_CONTACT = 'support@bilamo.example (placeholder)'

export function buildConfirmationDocument(session: TicketSession): ConfirmationDocument {
  const issuedLines = session.lines.filter((l) => l.status === 'issued')
  const flightSegments = issuedLines.flatMap((l) => l.flightSegments)
  const roomDetails = issuedLines.flatMap((l) => l.hotelRooms)
  const airlinePnrs = issuedLines
    .map((l) => l.airlinePnr)
    .filter((v): v is string => Boolean(v))
  const hotelConfirmationNumbers = issuedLines
    .map((l) => l.hotelConfirmationNumber)
    .filter((v): v is string => Boolean(v))
  const bookingReferences = [
    session.bookingReference,
    ...issuedLines.map((l) => l.providerBookingReference).filter((v): v is string => Boolean(v)),
  ]
  const hotelLine = issuedLines.find((l) => l.kind === 'hotel')
  const confirmationNumber = session.confirmationNumber
    || `CNF-${session.id.slice(0, 8).toUpperCase()}`
  const issuedAt = session.issuedAt || new Date().toISOString()

  const itinerarySummary = [
    ...issuedLines.filter((l) => l.kind === 'flight').map((l) => `Flight: ${l.title}`),
    ...issuedLines.filter((l) => l.kind === 'hotel').map((l) => `Hotel: ${l.title}`),
  ].join(' · ') || session.bookingReference

  const cancellationNotes = [
    'Cancellation and change policies follow the issuing provider rules.',
    'Contact Bilamo support before voiding issued tickets.',
  ]

  return {
    id: `doc_${session.id}`,
    ticketSessionId: session.id,
    confirmationNumber,
    bookingReference: session.bookingReference,
    issuedAt,
    travelers: session.travelers,
    itinerarySummary,
    flightSegments,
    airlinePnrs,
    hotelName: hotelLine?.hotelName ?? null,
    hotelAddress: hotelLine?.hotelAddress ?? null,
    checkIn: hotelLine?.checkIn ?? null,
    checkOut: hotelLine?.checkOut ?? null,
    roomDetails,
    hotelConfirmationNumbers,
    bookingReferences: [...new Set(bookingReferences)],
    paymentSummary: session.paymentSummary,
    cancellationNotes,
    supportContact: SUPPORT_CONTACT,
    qrCodeData: {
      format: 'rahhal-ticket-v1',
      ticketSessionId: session.id,
      confirmationNumber,
      issuedAt,
      lineReferences: issuedLines
        .map((l) => l.airlinePnr || l.hotelConfirmationNumber || l.providerBookingReference)
        .filter((v): v is string => Boolean(v)),
    },
    lines: session.lines.map((l) => ({
      kind: l.kind,
      status: l.status,
      title: l.title,
      reference: l.airlinePnr || l.hotelConfirmationNumber || l.providerBookingReference,
    })),
  }
}
