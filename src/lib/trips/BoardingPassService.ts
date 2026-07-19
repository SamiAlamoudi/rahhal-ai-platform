/**
 * Sprint 35 — BoardingPassService (abstraction only; no airline wallet APIs).
 */

import type { BoardingPassDoc, ETicketDoc } from './postBookingTypes'

export class BoardingPassService {
  generate(tripId: string, ticket: ETicketDoc | null, gate?: string | null): BoardingPassDoc | null {
    if (!ticket) return null
    const passId = `bp_${Math.random().toString(36).slice(2, 10)}`
    const gateValue = gate ?? 'B12'
    return {
      passId,
      tripId,
      ticketId: ticket.ticketId,
      seat: '12A',
      gate: gateValue,
      boardingTime: null,
      barcodePayload: `rahhal-bp-v1:${ticket.flightConfirmation}:${passId}`,
      generatedAt: new Date().toISOString(),
    }
  }
}

export function createBoardingPassService(): BoardingPassService {
  return new BoardingPassService()
}
