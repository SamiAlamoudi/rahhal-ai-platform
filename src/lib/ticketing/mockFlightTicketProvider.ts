/**
 * MockFlightTicketProvider — deterministic flight e-ticket issuance for tests.
 */

import { stableHash } from './privacy'
import type {
  TicketIssueRequest,
  TicketIssueResult,
  TicketProviderAdapter,
  TicketProviderCapabilities,
} from './ticketProviderAdapter'
import type { TicketLineItem } from './types'

export class MockFlightTicketProvider implements TicketProviderAdapter {
  readonly providerId = 'mock_flight_ticket'
  readonly displayName = 'Mock Flight Ticket Provider'

  getCapabilities(): TicketProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      kinds: ['flight'],
      supportsReissue: true,
      supportsVoid: true,
      mocked: true,
    }
  }

  supports(kind: 'flight' | 'hotel'): boolean {
    return kind === 'flight'
  }

  async issue(request: TicketIssueRequest): Promise<TicketIssueResult> {
    if (request.forceFail) {
      return {
        success: false,
        lineId: request.lineId,
        providerBookingReference: null,
        airlinePnr: null,
        hotelConfirmationNumber: null,
        flightSegments: request.flightSegments,
        hotelRooms: [],
        message: 'Mock flight issuance failed (forced)',
      }
    }

    const hash = stableHash(`${request.seed}:${request.lineId}:flight`)
    const airline = request.flightSegments[0]?.airline || 'Mock Air'
    const pnr = `PNR${(hash % 1_000_000).toString().padStart(6, '0')}`
    const bookingRef = `FL-${(hash % 90_000 + 10_000).toString()}`

    const flightSegments = request.flightSegments.length
      ? request.flightSegments.map((segment, index) => ({
        ...segment,
        flightNumber: segment.flightNumber || `${airline.slice(0, 2).toUpperCase()}${(hash % 900) + 100 + index}`,
        baggage: segment.baggage ?? '1 x 23kg',
      }))
      : [{
        segmentNumber: 1,
        airline,
        flightNumber: `MA${(hash % 900) + 100}`,
        from: 'RUH',
        to: 'XXX',
        departureAt: null,
        arrivalAt: null,
        cabin: 'economy',
        baggage: '1 x 23kg',
      }]

    return {
      success: true,
      lineId: request.lineId,
      providerBookingReference: bookingRef,
      airlinePnr: pnr,
      hotelConfirmationNumber: null,
      flightSegments,
      hotelRooms: [],
      message: 'Flight e-ticket issued (mock)',
    }
  }

  async voidIssuance(line: TicketLineItem, seed: string): Promise<{ success: boolean; message: string }> {
    void seed
    if (!line.airlinePnr && !line.providerBookingReference) {
      return { success: false, message: 'Nothing to void on flight line' }
    }
    return { success: true, message: 'Flight ticket voided (mock)' }
  }
}
