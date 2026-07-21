/**
 * Sprint 62 — Unified Trip Management contracts.
 * Consumer of Booking Execution; does not duplicate providers or booking logic.
 */

import type { BookingLifecycleStatus, BookingTravelerInfo, UnifiedBooking } from '../bookingExecution/types'
import type { DocumentRecord, UnifiedTicket } from '../paymentsPlatform/types'

/** Normalized booking lifecycle for trips (provider-agnostic). */
export type TripLifecycleStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Ticketed'
  | 'CheckedIn'
  | 'Completed'
  | 'Cancelled'
  | 'Expired'
  | 'RefundPending'
  | 'Refunded'

export type TripPaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'failed'

export type TripPurpose = 'business' | 'leisure' | 'unknown'

export type TripTimelineEventType =
  | 'BookingCreated'
  | 'PaymentCompleted'
  | 'FlightTicketIssued'
  | 'HotelConfirmed'
  | 'DocumentsGenerated'
  | 'CheckInOpened'
  | 'FlightDeparted'
  | 'FlightArrived'
  | 'TripCompleted'
  | 'Cancellation'
  | 'Refund'

export type TripSortMode = 'Upcoming' | 'Recent' | 'Completed' | 'Cancelled'

export type TripFilterMode =
  | 'Active'
  | 'Past'
  | 'Cancelled'
  | 'Refunded'
  | 'Business'
  | 'Leisure'

export interface TripTraveler {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
}

export interface TripFlightSegment {
  bookingId: string
  provider: string
  confirmation: string | null
  pnr: string | null
  ticketNumbers: string[]
  origin: string | null
  destination: string | null
  departureAt: string | null
  arrivalAt: string | null
  status: TripLifecycleStatus
}

export interface TripHotelStay {
  bookingId: string
  provider: string
  hotelName: string | null
  confirmation: string | null
  reservationId: string | null
  roomType: string | null
  checkIn: string | null
  checkOut: string | null
  guestNames: string[]
  status: TripLifecycleStatus
}

export interface TripTimelineEvent {
  id: string
  timestamp: string
  type: TripTimelineEventType
  provider: string | null
  details: Record<string, unknown>
}

export interface TripBookingRef {
  bookingId: string
  domain: UnifiedBooking['domain']
  provider: string
  confirmation: string | null
  pnr: string | null
  providerBookingId: string | null
  hotelConfirmation: string | null
  status: TripLifecycleStatus
}

/** Unified trip record — every reservation regardless of provider. */
export interface ManagedTrip {
  tripId: string
  userId: string
  travelers: TripTraveler[]
  destination: string
  origin: string
  departure: string | null
  return: string | null
  /** Primary / joined provider label for display. */
  provider: string
  providers: string[]
  bookingReferences: string[]
  pnrs: string[]
  flights: TripFlightSegment[]
  hotels: TripHotelStay[]
  bookings: TripBookingRef[]
  bookingStatus: TripLifecycleStatus
  paymentStatus: TripPaymentStatus
  purpose: TripPurpose
  /** Booking Execution session id (when created from execution). */
  executionSessionId: string | null
  /** DocumentCenter paymentSessionId key (`exec_${sessionId}`). */
  documentSessionId: string | null
  conversationId: string | null
  timeline: TripTimelineEvent[]
  createdAt: string
  updatedAt: string
}

export interface TripDocumentBundle {
  tickets: UnifiedTicket[]
  hotelVouchers: DocumentRecord[]
  invoice: DocumentRecord | null
  receipts: DocumentRecord[]
  summary: DocumentRecord | null
  all: DocumentRecord[]
}

export interface TripSearchQuery {
  destination?: string
  traveler?: string
  bookingReference?: string
  pnr?: string
  hotel?: string
  /** ISO date (YYYY-MM-DD) matched against departure/return/check-in/check-out. */
  date?: string
  status?: TripLifecycleStatus
  userId?: string
}

export interface ProviderStatusUpdate {
  bookingId?: string
  orderId?: string
  provider: string
  status: string
  pnr?: string | null
  ticketNumbers?: string[]
  hotelConfirmation?: string | null
  checkIn?: string | null
  checkOut?: string | null
  details?: Record<string, unknown>
  at?: string
}

export interface CreateTripFromExecutionInput {
  userId: string
  bookings: UnifiedBooking[]
  travelers?: BookingTravelerInfo[]
  executionSessionId?: string | null
  conversationId?: string | null
  destination?: string | null
  origin?: string | null
  departure?: string | null
  return?: string | null
  purpose?: TripPurpose
  paymentStatus?: TripPaymentStatus
  generateDocuments?: boolean
  now?: () => number
}

export type { BookingLifecycleStatus, UnifiedBooking }
