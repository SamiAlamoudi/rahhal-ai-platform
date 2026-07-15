/**
 * TicketProviderAdapter — vendor-agnostic ticketing port.
 * Mock flight / hotel providers implement this; TicketOrchestrator stays provider-blind.
 */

import type {
  FlightSegmentDetail,
  HotelRoomDetail,
  TicketLineItem,
  TicketTraveler,
} from './types'

export interface TicketIssueRequest {
  ticketSessionId: string
  lineId: string
  bookingItemId: string
  title: string
  providerId: string
  travelers: TicketTraveler[]
  flightSegments: FlightSegmentDetail[]
  hotelRooms: HotelRoomDetail[]
  hotelName: string | null
  hotelAddress: string | null
  checkIn: string | null
  checkOut: string | null
  /** Deterministic seed for mock providers. */
  seed: string
  /** Force failure for tests / simulated outages. */
  forceFail?: boolean
}

export interface TicketIssueResult {
  success: boolean
  lineId: string
  providerBookingReference: string | null
  airlinePnr: string | null
  hotelConfirmationNumber: string | null
  flightSegments: FlightSegmentDetail[]
  hotelRooms: HotelRoomDetail[]
  message: string
}

export interface TicketProviderCapabilities {
  providerId: string
  displayName: string
  kinds: Array<'flight' | 'hotel'>
  supportsReissue: boolean
  supportsVoid: boolean
  mocked: boolean
}

export interface TicketProviderAdapter {
  readonly providerId: string
  readonly displayName: string
  getCapabilities(): TicketProviderCapabilities
  supports(kind: 'flight' | 'hotel'): boolean
  issue(request: TicketIssueRequest): Promise<TicketIssueResult>
  voidIssuance(line: TicketLineItem, seed: string): Promise<{ success: boolean; message: string }>
}
