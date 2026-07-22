/**
 * Sprint 102 — Booking Execution & Confirmation contracts.
 * Additive presentation / orchestration — no provider-specific logic.
 */

export const SPRINT102_BOOKING_EXECUTION_VERSION = '1.0.0-booking-execution-confirmation'

/** Booking lifecycle states for the assistant execution flow. */
export type BookingExecutionLifecycle =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled'

export interface BookingPriceBreakdown {
  baseFare: number | null
  taxes: number | null
  fees: number | null
  total: number | null
  currency: string
  /** Present only when an upstream engine provided savings. */
  savings: number | null
}

export interface BookingCancellationPolicy {
  refundable: boolean | null
  summary: string | null
  deadline: string | null
}

export interface BookingItinerarySummary {
  destination: string | null
  origin: string | null
  startDate: string | null
  endDate: string | null
  flightLabel: string | null
  hotelLabel: string | null
  packageLabel: string | null
  travelerCount: number | null
}

export interface BookingTravelerDraft {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  passportNumber: string | null
  passportExpiry: string | null
  nationality: string | null
  email: string | null
  phone: string | null
}

export interface BookingExecutionComposeInput {
  conversationId?: string
  bookingId?: string
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  travelerCount?: number | null
  flightLabel?: string | null
  hotelLabel?: string | null
  packageLabel?: string | null
  baseFare?: number | null
  taxes?: number | null
  fees?: number | null
  total?: number | null
  savings?: number | null
  currency?: string | null
  cancellationPolicy?: BookingCancellationPolicy | null
  travelers?: BookingTravelerDraft[]
  /** Opaque offer/selection ids from existing engines — never re-priced here. */
  offerRefs?: {
    flightId?: string | null
    hotelId?: string | null
    packageId?: string | null
  }
}

export interface AbstractBookRequest {
  bookingId: string
  conversationId: string | null
  itinerary: BookingItinerarySummary
  pricing: BookingPriceBreakdown
  travelers: BookingTravelerDraft[]
  offerRefs: {
    flightId: string | null
    hotelId: string | null
    packageId: string | null
  }
  cancellationPolicy: BookingCancellationPolicy | null
}

export interface AbstractBookResult {
  ok: boolean
  /** Provider-agnostic booking reference. */
  bookingReference: string | null
  /** PNR placeholder until a live adapter supplies a real locator. */
  pnrPlaceholder: string | null
  lifecycle: BookingExecutionLifecycle
  error: string | null
  raw?: Record<string, unknown>
}

export interface AbstractCancelRequest {
  bookingId: string
  bookingReference: string | null
}

export interface AbstractCancelResult {
  ok: boolean
  lifecycle: BookingExecutionLifecycle
  error: string | null
}
