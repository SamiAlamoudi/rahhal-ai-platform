/**
 * Sprint 102 — session store + orchestration bridge for Booking Execution UI.
 * In-memory only — does not touch live booking engines or providers.
 */

import {
  composeBookingExecutionReview,
  createStubBookingProviderAdapter,
  executeBookNow,
  advanceToTravelerConfirmation,
  formatConfirmationShareText,
  SPRINT102_BOOKING_EXECUTION_VERSION,
  type BookingExecutionComposeInput,
  type BookingExecutionExperience,
  type BookingProviderAdapter,
  type BookingTravelerDraft,
} from '../../core'
import { isBookingExecutionConfirmationEnabled } from './feature'

export { SPRINT102_BOOKING_EXECUTION_VERSION }

const sessions = new Map<string, BookingExecutionExperience>()

export interface StartBookingExecutionInput {
  compose: BookingExecutionComposeInput
  enabled?: boolean
}

export function startBookingExecutionReview(
  input: StartBookingExecutionInput,
): BookingExecutionExperience | null {
  if (!isBookingExecutionConfirmationEnabled({ enabled: input.enabled })) {
    return null
  }
  const experience = composeBookingExecutionReview(input.compose, { enabled: true })
  sessions.set(experience.bookingId, experience)
  return experience
}

export function getBookingExecutionSession(
  bookingId: string,
): BookingExecutionExperience | null {
  return sessions.get(bookingId) ?? null
}

export function saveBookingExecutionSession(
  experience: BookingExecutionExperience,
): void {
  sessions.set(experience.bookingId, experience)
}

export function confirmTravelersForBooking(
  bookingId: string,
  travelers: BookingTravelerDraft[],
): BookingExecutionExperience | null {
  const current = sessions.get(bookingId)
  if (!current || !current.enabled) return null
  const next = advanceToTravelerConfirmation(current, travelers)
  sessions.set(bookingId, next)
  return next
}

export async function bookNowForBooking(input: {
  bookingId: string
  compose: BookingExecutionComposeInput
  travelers: BookingTravelerDraft[]
  adapter?: BookingProviderAdapter
}): Promise<BookingExecutionExperience | null> {
  const current = sessions.get(input.bookingId)
  if (!current || !current.enabled) return null
  const adapter = input.adapter ?? createStubBookingProviderAdapter()
  const next = await executeBookNow(current, {
    compose: input.compose,
    travelers: input.travelers,
    adapter,
  })
  sessions.set(next.bookingId, next)
  return next
}

export function buildSharePayload(bookingId: string): string | null {
  const session = sessions.get(bookingId)
  if (!session?.confirmation) return null
  return formatConfirmationShareText(session.confirmation)
}

/** Test helper — clear in-memory sessions. */
export function resetBookingExecutionSessions(): void {
  sessions.clear()
}

/**
 * Map Booking Assistant summary-ish fields into compose input (read-only).
 */
export function composeInputFromAssistantSnapshot(snapshot: {
  conversationId?: string
  destination?: string | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  travelers?: number | null
  flightLabel?: string | null
  hotelLabel?: string | null
  packageLabel?: string | null
  total?: number | null
  taxes?: number | null
  baseFare?: number | null
  fees?: number | null
  savings?: number | null
  currency?: string | null
  cancellationSummary?: string | null
  refundable?: boolean | null
  flightId?: string | null
  hotelId?: string | null
  packageId?: string | null
}): BookingExecutionComposeInput {
  return {
    conversationId: snapshot.conversationId,
    destination: snapshot.destination ?? null,
    origin: snapshot.origin ?? null,
    startDate: snapshot.startDate ?? null,
    endDate: snapshot.endDate ?? null,
    travelerCount: snapshot.travelers ?? null,
    flightLabel: snapshot.flightLabel ?? null,
    hotelLabel: snapshot.hotelLabel ?? null,
    packageLabel: snapshot.packageLabel ?? null,
    total: snapshot.total ?? null,
    taxes: snapshot.taxes ?? null,
    baseFare: snapshot.baseFare ?? null,
    fees: snapshot.fees ?? null,
    savings: snapshot.savings ?? null,
    currency: snapshot.currency ?? 'SAR',
    cancellationPolicy: snapshot.cancellationSummary || snapshot.refundable != null
      ? {
        refundable: snapshot.refundable ?? null,
        summary: snapshot.cancellationSummary ?? null,
        deadline: null,
      }
      : null,
    offerRefs: {
      flightId: snapshot.flightId ?? null,
      hotelId: snapshot.hotelId ?? null,
      packageId: snapshot.packageId ?? null,
    },
  }
}
