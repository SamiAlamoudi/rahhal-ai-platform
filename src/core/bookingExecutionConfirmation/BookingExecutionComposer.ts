/**
 * Sprint 102 — BookingExecutionComposer
 * Assembles review → traveler confirmation → book-now → confirmation presentation.
 */

import { runBookNowWorkflow, type BookNowResult } from './BookNowWorkflow'
import type { BookingProviderAdapter } from './BookingProviderAdapter'
import {
  buildBookingConfirmationModel,
  type BookingConfirmationModel,
} from './BookingConfirmationModel'
import { createPendingLifecycle, type BookingLifecycleSnapshot } from './BookingLifecycle'
import { buildBookingReviewModel, type BookingReviewModel } from './BookingReviewModel'
import {
  validateTravelerConfirmation,
  type TravelerConfirmationResult,
} from './TravelerConfirmation'
import {
  SPRINT102_BOOKING_EXECUTION_VERSION,
  type BookingExecutionComposeInput,
  type BookingTravelerDraft,
} from './types'

export { SPRINT102_BOOKING_EXECUTION_VERSION }

export type BookingExecutionStep =
  | 'review'
  | 'traveler_confirmation'
  | 'booking'
  | 'confirmation'

export interface BookingExecutionExperience {
  version: string
  enabled: boolean
  conversationId: string | null
  bookingId: string
  step: BookingExecutionStep
  review: BookingReviewModel
  travelerValidation: TravelerConfirmationResult | null
  lifecycle: BookingLifecycleSnapshot
  confirmation: BookingConfirmationModel | null
  bookNowResult: BookNowResult | null
  durationMs: number
}

function newIds(now: number): { conversationId: string; bookingId: string } {
  const stamp = now.toString(36)
  return {
    conversationId: `conv_${stamp}`,
    bookingId: `bx_${stamp}_${Math.random().toString(36).slice(2, 8)}`,
  }
}

export function composeBookingExecutionReview(
  input: BookingExecutionComposeInput,
  options?: { enabled?: boolean; startedAt?: number },
): BookingExecutionExperience {
  const started = options?.startedAt ?? Date.now()
  const enabled = options?.enabled !== false
  const ids = newIds(started)
  const bookingId = input.bookingId?.trim() || ids.bookingId
  const conversationId = input.conversationId?.trim() || null

  if (!enabled) {
    return {
      version: SPRINT102_BOOKING_EXECUTION_VERSION,
      enabled: false,
      conversationId,
      bookingId,
      step: 'review',
      review: buildBookingReviewModel({}),
      travelerValidation: null,
      lifecycle: createPendingLifecycle(),
      confirmation: null,
      bookNowResult: null,
      durationMs: Math.max(0, Date.now() - started),
    }
  }

  return {
    version: SPRINT102_BOOKING_EXECUTION_VERSION,
    enabled: true,
    conversationId,
    bookingId,
    step: 'review',
    review: buildBookingReviewModel(input),
    travelerValidation: null,
    lifecycle: createPendingLifecycle(),
    confirmation: null,
    bookNowResult: null,
    durationMs: Math.max(0, Date.now() - started),
  }
}

export function advanceToTravelerConfirmation(
  experience: BookingExecutionExperience,
  travelers: BookingTravelerDraft[],
): BookingExecutionExperience {
  if (!experience.enabled) return experience
  const validation = validateTravelerConfirmation(travelers)
  return {
    ...experience,
    step: 'traveler_confirmation',
    review: {
      ...experience.review,
      travelers: [...travelers],
    },
    travelerValidation: validation,
  }
}

export async function executeBookNow(
  experience: BookingExecutionExperience,
  input: {
    compose: BookingExecutionComposeInput
    travelers: BookingTravelerDraft[]
    adapter: BookingProviderAdapter
  },
): Promise<BookingExecutionExperience> {
  if (!experience.enabled) return experience

  const validation = validateTravelerConfirmation(input.travelers)
  if (!validation.ok) {
    return {
      ...experience,
      step: 'traveler_confirmation',
      travelerValidation: validation,
      review: { ...experience.review, travelers: [...input.travelers] },
    }
  }

  const result = await runBookNowWorkflow({
    compose: input.compose,
    travelers: input.travelers,
    adapter: input.adapter,
    bookingId: experience.bookingId,
  })

  const review = buildBookingReviewModel({
    ...input.compose,
    travelers: input.travelers,
  })

  const confirmation = result.ok
    ? buildBookingConfirmationModel({
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      pnrPlaceholder: result.pnrPlaceholder,
      lifecycle: result.lifecycle,
      itinerary: review.itinerary,
      pricing: review.pricing,
    })
    : null

  return {
    ...experience,
    bookingId: result.bookingId,
    step: result.ok ? 'confirmation' : 'booking',
    review,
    travelerValidation: validation,
    lifecycle: result.lifecycle,
    confirmation,
    bookNowResult: result,
  }
}

export class BookingExecutionComposer {
  composeReview(
    input: BookingExecutionComposeInput,
    options?: { enabled?: boolean },
  ): BookingExecutionExperience {
    return composeBookingExecutionReview(input, options)
  }

  validateTravelers(
    experience: BookingExecutionExperience,
    travelers: BookingTravelerDraft[],
  ): BookingExecutionExperience {
    return advanceToTravelerConfirmation(experience, travelers)
  }

  bookNow(
    experience: BookingExecutionExperience,
    input: {
      compose: BookingExecutionComposeInput
      travelers: BookingTravelerDraft[]
      adapter: BookingProviderAdapter
    },
  ): Promise<BookingExecutionExperience> {
    return executeBookNow(experience, input)
  }
}

export function createBookingExecutionComposer(): BookingExecutionComposer {
  return new BookingExecutionComposer()
}
