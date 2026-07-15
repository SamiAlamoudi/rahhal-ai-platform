/**
 * MockHotelVoucherProvider — deterministic hotel confirmation vouchers for tests.
 */

import { stableHash } from './privacy'
import type {
  TicketIssueRequest,
  TicketIssueResult,
  TicketProviderAdapter,
  TicketProviderCapabilities,
} from './ticketProviderAdapter'
import type { TicketLineItem } from './types'

export class MockHotelVoucherProvider implements TicketProviderAdapter {
  readonly providerId = 'mock_hotel_voucher'
  readonly displayName = 'Mock Hotel Voucher Provider'

  getCapabilities(): TicketProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      kinds: ['hotel'],
      supportsReissue: true,
      supportsVoid: true,
      mocked: true,
    }
  }

  supports(kind: 'flight' | 'hotel'): boolean {
    return kind === 'hotel'
  }

  async issue(request: TicketIssueRequest): Promise<TicketIssueResult> {
    if (request.forceFail) {
      return {
        success: false,
        lineId: request.lineId,
        providerBookingReference: null,
        airlinePnr: null,
        hotelConfirmationNumber: null,
        flightSegments: [],
        hotelRooms: request.hotelRooms,
        message: 'Mock hotel voucher issuance failed (forced)',
      }
    }

    const hash = stableHash(`${request.seed}:${request.lineId}:hotel`)
    const confirmation = `HTL${(hash % 1_000_000).toString().padStart(6, '0')}`
    const bookingRef = `HT-${(hash % 90_000 + 10_000).toString()}`
    const hotelRooms = request.hotelRooms.length
      ? request.hotelRooms
      : [{
        roomIndex: 1,
        roomType: 'Standard Twin',
        board: 'room_only',
        guests: Math.max(1, request.travelers.length),
      }]

    return {
      success: true,
      lineId: request.lineId,
      providerBookingReference: bookingRef,
      airlinePnr: null,
      hotelConfirmationNumber: confirmation,
      flightSegments: [],
      hotelRooms,
      message: 'Hotel confirmation voucher issued (mock)',
    }
  }

  async voidIssuance(line: TicketLineItem, seed: string): Promise<{ success: boolean; message: string }> {
    void seed
    if (!line.hotelConfirmationNumber && !line.providerBookingReference) {
      return { success: false, message: 'Nothing to void on hotel line' }
    }
    return { success: true, message: 'Hotel voucher voided (mock)' }
  }
}
