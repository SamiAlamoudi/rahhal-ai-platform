/**
 * Sprint 35 — Post-booking domain types (additive to ManagedTrip).
 */

import type { ManagedTrip, ManagedTripStatus } from './types'

export type TripLifecycleBucket = 'Upcoming' | 'Active' | 'Completed' | 'Cancelled'

export type TripNotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms'

export type TripNotificationTrigger =
  | 'booking_confirmed'
  | 'payment_received'
  | 'check_in_reminder'
  | 'gate_change'
  | 'flight_delay'
  | 'boarding_reminder'
  | 'hotel_check_in_reminder'
  | 'trip_completed'

export type FlightStatusKind =
  | 'scheduled'
  | 'on_time'
  | 'delayed'
  | 'gate_change'
  | 'cancelled'
  | 'landed'
  | 'diverted'

export type RefundTrackingStatus =
  | 'none'
  | 'requested'
  | 'processing'
  | 'partial'
  | 'completed'
  | 'failed'

export interface TripBookingReferences {
  bookingReference: string
  tripReference: string
  paymentReference: string
  flightConfirmation: string | null
  hotelConfirmation: string | null
  executionSessionId: string | null
  paymentSessionId: string | null
}

export interface GeneratedItinerary {
  itineraryId: string
  tripId: string
  title: string
  destination: string
  startDate: string | null
  endDate: string | null
  days: Array<{
    day: number
    title: string
    items: string[]
  }>
  summaryText: string
  generatedAt: string
}

export interface BookingSummaryDoc {
  summaryId: string
  tripId: string
  bookingReference: string
  total: number
  currency: string
  travelers: number
  flightConfirmation: string | null
  hotelConfirmation: string | null
  hotelName: string | null
  generatedAt: string
}

export interface HotelVoucherDoc {
  voucherId: string
  tripId: string
  hotelName: string
  confirmationNumber: string
  checkIn: string | null
  checkOut: string | null
  guests: number
  pdfUri: string
  generatedAt: string
}

export interface ETicketDoc {
  ticketId: string
  tripId: string
  passengerName: string
  flightConfirmation: string
  from: string | null
  to: string | null
  pdfUri: string
  generatedAt: string
}

export interface BoardingPassDoc {
  passId: string
  tripId: string
  ticketId: string
  seat: string | null
  gate: string | null
  boardingTime: string | null
  barcodePayload: string
  generatedAt: string
}

export interface PdfItineraryDoc {
  documentId: string
  tripId: string
  fileName: string
  pdfUri: string
  pages: number
  generatedAt: string
}

export interface InvoiceBundleDoc {
  bundleId: string
  tripId: string
  receiptId: string | null
  invoiceId: string | null
  pdfUri: string
  generatedAt: string
}

export interface TripDocumentBundle {
  itinerary: GeneratedItinerary
  bookingSummary: BookingSummaryDoc
  hotelVoucher: HotelVoucherDoc | null
  eTicket: ETicketDoc | null
  boardingPass: BoardingPassDoc | null
  pdfItinerary: PdfItineraryDoc
  paymentReceiptId: string | null
  invoiceBundle: InvoiceBundleDoc
}

export interface FlightStatusSnapshot {
  providerId: string
  flightConfirmation: string
  status: FlightStatusKind
  delayMinutes: number
  gate: string | null
  previousGate: string | null
  departureAirport: string | null
  arrivalAirport: string | null
  message: string
  checkedAt: string
}

export interface ScheduledTripNotification {
  notificationId: string
  tripId: string
  trigger: TripNotificationTrigger
  channels: TripNotificationChannel[]
  scheduledFor: string
  sentAt: string | null
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed'
  title: string
  body: string
}

export interface PostBookingTripRecord {
  tripId: string
  userId: string
  conversationId: string | null
  references: TripBookingReferences
  lifecycle: TripLifecycleBucket
  managedStatus: ManagedTripStatus
  destination: string
  hotelName: string | null
  origin: string | null
  documents: TripDocumentBundle
  flightStatus: FlightStatusSnapshot | null
  refundStatus: RefundTrackingStatus
  refundedAmount: number
  currency: string
  totalPaid: number
  notifications: ScheduledTripNotification[]
  createdAt: string
  updatedAt: string
}

export interface CreatePostBookingTripInput {
  userId: string
  conversationId?: string | null
  title?: string
  destination: string
  origin?: string | null
  hotelName?: string | null
  startDate?: string | null
  endDate?: string | null
  currency: string
  totalPaid: number
  travelers?: number
  passengerName?: string
  references: TripBookingReferences
  paymentReceiptId?: string | null
  invoiceId?: string | null
  locale?: 'ar' | 'en'
}

export type { ManagedTrip }
