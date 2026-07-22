/**
 * Sprint 102 — Book Now workflow via abstract BookingProviderAdapter only.
 */

import type { BookingProviderAdapter } from './BookingProviderAdapter'
import {
  createPendingLifecycle,
  transitionLifecycle,
  type BookingLifecycleSnapshot,
} from './BookingLifecycle'
import { buildBookingReviewModel } from './BookingReviewModel'
import { validateTravelerConfirmation } from './TravelerConfirmation'
import type {
  BookingExecutionComposeInput,
  BookingExecutionLifecycle,
  BookingTravelerDraft,
} from './types'

export interface BookNowResult {
  ok: boolean
  bookingId: string
  lifecycle: BookingLifecycleSnapshot
  bookingReference: string | null
  pnrPlaceholder: string | null
  error: string | null
  validationErrors: ReturnType<typeof validateTravelerConfirmation>['errors']
}

function newBookingId(): string {
  return `bx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Execute Book Now through the abstract adapter after traveler validation.
 * Does not call search, pricing, or provider-selection engines.
 */
export async function runBookNowWorkflow(input: {
  compose: BookingExecutionComposeInput
  travelers: BookingTravelerDraft[]
  adapter: BookingProviderAdapter
  bookingId?: string
}): Promise<BookNowResult> {
  const bookingId = input.bookingId?.trim() || input.compose.bookingId?.trim() || newBookingId()
  const validation = validateTravelerConfirmation(input.travelers)
  if (!validation.ok) {
    return {
      ok: false,
      bookingId,
      lifecycle: transitionLifecycle(createPendingLifecycle(), 'failed', {
        error: 'Traveler confirmation incomplete.',
      }),
      bookingReference: null,
      pnrPlaceholder: null,
      error: 'Traveler confirmation incomplete.',
      validationErrors: validation.errors,
    }
  }

  let lifecycle = createPendingLifecycle()
  const review = buildBookingReviewModel({
    ...input.compose,
    travelers: input.travelers,
  })

  try {
    const result = await input.adapter.book({
      bookingId,
      conversationId: input.compose.conversationId ?? null,
      itinerary: review.itinerary ?? {
        destination: null,
        origin: null,
        startDate: null,
        endDate: null,
        flightLabel: null,
        hotelLabel: null,
        packageLabel: null,
        travelerCount: input.travelers.length,
      },
      pricing: review.pricing ?? {
        baseFare: null,
        taxes: null,
        fees: null,
        total: null,
        currency: (input.compose.currency || 'SAR').toUpperCase(),
        savings: null,
      },
      travelers: input.travelers,
      offerRefs: review.offerRefs,
      cancellationPolicy: review.cancellationPolicy,
    })

    const nextStatus: BookingExecutionLifecycle = result.ok
      ? (result.lifecycle === 'confirmed' ? 'confirmed' : result.lifecycle)
      : 'failed'

    lifecycle = transitionLifecycle(lifecycle, nextStatus, {
      error: result.error,
    })

    return {
      ok: result.ok && nextStatus === 'confirmed',
      bookingId,
      lifecycle,
      bookingReference: result.bookingReference,
      pnrPlaceholder: result.pnrPlaceholder,
      error: result.error,
      validationErrors: [],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Booking adapter error.'
    lifecycle = transitionLifecycle(lifecycle, 'failed', { error: message })
    return {
      ok: false,
      bookingId,
      lifecycle,
      bookingReference: null,
      pnrPlaceholder: null,
      error: message,
      validationErrors: [],
    }
  }
}

export async function runCancelBookingWorkflow(input: {
  bookingId: string
  bookingReference: string | null
  adapter: BookingProviderAdapter
  lifecycle: BookingLifecycleSnapshot
}): Promise<{ ok: boolean; lifecycle: BookingLifecycleSnapshot; error: string | null }> {
  if (!input.adapter.cancel) {
    return {
      ok: false,
      lifecycle: transitionLifecycle(input.lifecycle, 'failed', {
        error: 'Adapter does not support cancel.',
      }),
      error: 'Adapter does not support cancel.',
    }
  }
  try {
    const result = await input.adapter.cancel({
      bookingId: input.bookingId,
      bookingReference: input.bookingReference,
    })
    const lifecycle = transitionLifecycle(
      input.lifecycle,
      result.ok ? 'cancelled' : 'failed',
      { error: result.error },
    )
    return { ok: result.ok, lifecycle, error: result.error }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancel failed.'
    return {
      ok: false,
      lifecycle: transitionLifecycle(input.lifecycle, 'failed', { error: message }),
      error: message,
    }
  }
}
