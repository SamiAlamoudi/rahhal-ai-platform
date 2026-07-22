/**
 * Sprint 101 — Booking readiness presentation (compose existing signals only).
 */

export const SPRINT101_BOOKING_ASSISTANT_VERSION = '1.0.0-booking-assistant'

export type BookingReadinessStatusId =
  | 'ready_to_book'
  | 'need_traveler_information'
  | 'need_passport'
  | 'need_payment_method'
  | 'need_destination_confirmation'
  | 'need_dates'
  | 'need_selection'
  | 'planning'

export interface BookingReadinessSection {
  id: 'readiness'
  status: BookingReadinessStatusId
  label: string
  detail: string | null
  readyToBook: boolean
}

export interface BookingAssistantComposeInput {
  conversationId?: string
  /** Alpha Experience DTO from Sprint 99 — optional. */
  alpha?: {
    enabled?: boolean
    conversationId?: string
    finalRecommendation?: string | null
    confidenceLevel?: string | null
    confidenceScore?: number | null
    nextAction?: string | null
    sectionIds?: string[]
  } | null
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  durationDays?: number | null
  travelers?: number | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  missingFields?: string[]
  flightSelected?: boolean
  hotelSelected?: boolean
  packageSelected?: boolean
  preferencesApplied?: boolean | null
  flight?: {
    id: string
    airline?: string | null
    origin?: string | null
    destination?: string | null
    price?: number | null
    currency?: string | null
  } | null
  hotel?: {
    id: string
    name?: string | null
    price?: number | null
    currency?: string | null
  } | null
  packageOffer?: {
    id: string
    title?: string | null
    totalPrice?: number | null
    currency?: string | null
    confidence?: number | null
  } | null
  estimatedTotal?: number | null
  /** Only when an existing engine already computed savings. */
  savings?: number | null
  currency?: string | null
  /** Reused confidence — never recompute. */
  confidenceScore?: number | null
  confidenceLevel?: 'high' | 'medium' | 'low' | null
  confidenceLabel?: string | null
  /** Price Intelligence supporting signals only. */
  priceTimingAction?: string | null
  priceOpportunities?: string[] | null
  priceExplanation?: string | null
  seatsRemaining?: number | null
  roomsRemaining?: number | null
  /** Existing travel-planner / document signals — omit when unknown. */
  visaRequiredSignal?: boolean | null
  passportStatus?: 'missing' | 'expiring' | 'ok' | null
  passportExpiresAt?: string | null
  paymentMethodPresent?: boolean | null
  bookingReadyFromEngine?: boolean | null
  paymentSessionActive?: boolean | null
  bookingConfirmed?: boolean | null
}

function hasDestination(input: BookingAssistantComposeInput): boolean {
  return Boolean(input.destination?.trim())
}

function hasDates(input: BookingAssistantComposeInput): boolean {
  return Boolean(input.startDate)
    || (input.durationDays != null && Number.isFinite(input.durationDays))
    || Boolean(input.startDate && input.endDate)
}

function hasTravelers(input: BookingAssistantComposeInput): boolean {
  return input.travelers != null && Number.isFinite(input.travelers) && input.travelers > 0
}

function hasSelection(input: BookingAssistantComposeInput): boolean {
  return Boolean(input.flightSelected || input.hotelSelected || input.packageSelected
    || input.flight?.id || input.hotel?.id || input.packageOffer?.id)
}

function missingIncludes(input: BookingAssistantComposeInput, field: string): boolean {
  return (input.missingFields ?? []).map(String).includes(field)
}

/**
 * Derive booking readiness label from existing requirement / selection signals.
 * Does not invent passport/payment needs without supporting input.
 */
export function buildBookingReadiness(
  input: BookingAssistantComposeInput,
): BookingReadinessSection {
  if (input.bookingConfirmed) {
    return {
      id: 'readiness',
      status: 'ready_to_book',
      label: 'Booking confirmed',
      detail: 'Your booking is confirmed.',
      readyToBook: true,
    }
  }

  if (!hasDestination(input) || missingIncludes(input, 'destination')) {
    return {
      id: 'readiness',
      status: 'need_destination_confirmation',
      label: 'Need Destination Confirmation',
      detail: 'Confirm where you want to travel.',
      readyToBook: false,
    }
  }

  if (!hasTravelers(input) || missingIncludes(input, 'travelers')) {
    return {
      id: 'readiness',
      status: 'need_traveler_information',
      label: 'Need Traveler Information',
      detail: 'Confirm how many travelers are going.',
      readyToBook: false,
    }
  }

  if (!hasDates(input) || missingIncludes(input, 'startDate') || missingIncludes(input, 'durationDays')) {
    return {
      id: 'readiness',
      status: 'need_dates',
      label: 'Need Dates',
      detail: 'Confirm travel dates or trip duration.',
      readyToBook: false,
    }
  }

  if (input.passportStatus === 'missing') {
    return {
      id: 'readiness',
      status: 'need_passport',
      label: 'Need Passport',
      detail: 'Passport details are required before booking.',
      readyToBook: false,
    }
  }

  if (input.paymentMethodPresent === false && (input.bookingReadyFromEngine || hasSelection(input))) {
    return {
      id: 'readiness',
      status: 'need_payment_method',
      label: 'Need Payment Method',
      detail: 'Add a payment method to complete booking.',
      readyToBook: false,
    }
  }

  if (!hasSelection(input)) {
    return {
      id: 'readiness',
      status: 'need_selection',
      label: 'Need Selection',
      detail: 'Select a flight, hotel, or package to continue.',
      readyToBook: false,
    }
  }

  if (input.bookingReadyFromEngine === true || (hasSelection(input) && hasDestination(input) && hasTravelers(input) && hasDates(input))) {
    return {
      id: 'readiness',
      status: 'ready_to_book',
      label: 'Ready to Book',
      detail: 'Trip selections look complete — you can proceed to booking.',
      readyToBook: true,
    }
  }

  return {
    id: 'readiness',
    status: 'planning',
    label: 'Planning',
    detail: 'Continue refining your trip plan.',
    readyToBook: false,
  }
}
