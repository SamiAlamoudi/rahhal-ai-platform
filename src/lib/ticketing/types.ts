/**
 * Phase T — Ticketing & Confirmation Engine domain models.
 * Mock providers only; no live airline/hotel ticketing APIs.
 */

export type TicketSessionStatus =
  | 'created'
  | 'pending'
  | 'issuing'
  | 'issued'
  | 'delivered'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'voided'
  | 'reissue_required'

export type TicketLineKind = 'flight' | 'hotel'

export type TicketLineStatus =
  | 'pending'
  | 'issuing'
  | 'issued'
  | 'failed'
  | 'voided'
  | 'cancelled'
  | 'expired'

export interface TicketTraveler {
  id: string
  firstName: string
  lastName: string
  type: 'adult' | 'child' | 'infant'
  /** Never log raw passport — store only masked form when present. */
  passportMasked: string | null
  nationality: string | null
}

export interface FlightSegmentDetail {
  segmentNumber: number
  airline: string
  flightNumber: string
  from: string
  to: string
  departureAt: string | null
  arrivalAt: string | null
  cabin: string | null
  baggage: string | null
}

export interface HotelRoomDetail {
  roomIndex: number
  roomType: string
  board: string | null
  guests: number
}

export interface TicketLineItem {
  id: string
  kind: TicketLineKind
  bookingItemId: string
  status: TicketLineStatus
  title: string
  providerId: string
  providerBookingReference: string | null
  /** Airline PNR when flight line is issued. */
  airlinePnr: string | null
  /** Hotel confirmation code when hotel line is issued. */
  hotelConfirmationNumber: string | null
  travelers: TicketTraveler[]
  flightSegments: FlightSegmentDetail[]
  hotelRooms: HotelRoomDetail[]
  hotelName: string | null
  hotelAddress: string | null
  checkIn: string | null
  checkOut: string | null
  error: string | null
  issuedAt: string | null
  updatedAt: string
  attemptCount: number
}

export interface TicketAuditEvent {
  id: string
  at: string
  type: string
  message: string
  fromStatus: TicketSessionStatus | TicketLineStatus | null
  toStatus: TicketSessionStatus | TicketLineStatus | null
  lineId: string | null
  /** Sanitized metadata only — no secrets / raw PII. */
  metadata: Record<string, unknown>
}

export interface PaymentSummaryForTicket {
  orderId: string
  orderNumber: string
  paymentSessionId: string | null
  amount: number
  currency: string
  status: string
  paidAt: string | null
  /** Masked email e.g. a***@example.com */
  customerEmailMasked: string | null
}

export interface QrCodeDataPayload {
  /** Architecture placeholder — clients may render later. */
  format: 'rahhal-ticket-v1'
  ticketSessionId: string
  confirmationNumber: string
  issuedAt: string | null
  lineReferences: string[]
}

export interface ConfirmationDocument {
  id: string
  ticketSessionId: string
  confirmationNumber: string
  bookingReference: string
  issuedAt: string
  travelers: TicketTraveler[]
  itinerarySummary: string
  flightSegments: FlightSegmentDetail[]
  airlinePnrs: string[]
  hotelName: string | null
  hotelAddress: string | null
  checkIn: string | null
  checkOut: string | null
  roomDetails: HotelRoomDetail[]
  hotelConfirmationNumbers: string[]
  bookingReferences: string[]
  paymentSummary: PaymentSummaryForTicket
  cancellationNotes: string[]
  supportContact: string
  qrCodeData: QrCodeDataPayload
  lines: Array<{
    kind: TicketLineKind
    status: TicketLineStatus
    title: string
    reference: string | null
  }>
}

export interface TicketSession {
  id: string
  bookingSessionId: string
  orderId: string
  orderNumber: string
  status: TicketSessionStatus
  confirmationNumber: string | null
  bookingReference: string
  lines: TicketLineItem[]
  travelers: TicketTraveler[]
  paymentSummary: PaymentSummaryForTicket
  documents: ConfirmationDocument[]
  audit: TicketAuditEvent[]
  createdAt: string
  updatedAt: string
  expiresAt: string
  issuedAt: string | null
  deliveredAt: string | null
  /** Fingerprint used to prevent duplicate issuance for same booking+order. */
  issuanceKey: string
}

export const TICKET_SESSION_STATUS_VALUES: readonly TicketSessionStatus[] = [
  'created',
  'pending',
  'issuing',
  'issued',
  'delivered',
  'failed',
  'expired',
  'cancelled',
  'voided',
  'reissue_required',
] as const
