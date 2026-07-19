/**
 * Sprint 35 — TicketService (e-ticket abstraction; no live airline APIs).
 */

import type { CreatePostBookingTripInput, ETicketDoc } from './postBookingTypes'

export class TicketService {
  generate(input: CreatePostBookingTripInput, tripId: string): ETicketDoc | null {
    if (!input.references.flightConfirmation) return null
    const ticketId = `eticket_${Math.random().toString(36).slice(2, 10)}`
    return {
      ticketId,
      tripId,
      passengerName: input.passengerName ?? 'Traveler',
      flightConfirmation: input.references.flightConfirmation,
      from: input.origin ?? null,
      to: input.destination,
      pdfUri: `rahhal://documents/e-ticket/${ticketId}.pdf`,
      generatedAt: new Date().toISOString(),
    }
  }
}

export function createTicketService(): TicketService {
  return new TicketService()
}
