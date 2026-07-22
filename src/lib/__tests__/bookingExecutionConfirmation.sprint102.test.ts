/**
 * Sprint 102 — Booking Execution & Confirmation tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  createStubBookingProviderAdapter,
  composeBookingExecutionReview,
  advanceToTravelerConfirmation,
  executeBookNow,
  validateTravelerConfirmation,
  createEmptyTraveler,
  buildBookingReviewModel,
  buildBookingConfirmationModel,
  createPendingLifecycle,
  transitionLifecycle,
  SPRINT102_BOOKING_EXECUTION_VERSION,
  type BookingExecutionComposeInput,
  type BookingTravelerDraft,
} from '../../core'
import {
  BOOKING_EXECUTION_CONFIRMATION_FEATURE_ID,
  isBookingExecutionConfirmationEnabled,
  startBookingExecutionReview,
  confirmTravelersForBooking,
  bookNowForBooking,
  resetBookingExecutionSessions,
  composeInputFromAssistantSnapshot,
} from '../bookingExecutionConfirmation'

function sampleCompose(overrides?: Partial<BookingExecutionComposeInput>): BookingExecutionComposeInput {
  return {
    conversationId: 'conv_102',
    destination: 'Dubai',
    origin: 'Riyadh',
    startDate: '2026-08-15',
    endDate: '2026-08-20',
    travelerCount: 1,
    flightLabel: 'Saudia RUH → DXB',
    hotelLabel: 'Marina Hotel',
    packageLabel: 'Dubai balanced escape',
    baseFare: 3000,
    taxes: 400,
    fees: 200,
    total: 3600,
    savings: 250,
    currency: 'SAR',
    cancellationPolicy: {
      refundable: true,
      summary: 'Free cancellation up to 48 hours before departure.',
      deadline: '2026-08-13',
    },
    offerRefs: {
      flightId: 'flt_1',
      hotelId: 'htl_1',
      packageId: 'pkg_1',
    },
    ...overrides,
  }
}

function completeTraveler(id = 't1'): BookingTravelerDraft {
  return {
    id,
    firstName: 'Sara',
    lastName: 'Alharbi',
    dateOfBirth: '1994-05-12',
    passportNumber: 'A1234567',
    passportExpiry: '2030-01-01',
    nationality: 'SA',
    email: 'sara@example.com',
    phone: null,
  }
}

describe('Sprint 102 — Booking Execution & Confirmation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBookingExecutionSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBookingExecutionSessions()
  })

  it('registers ai.booking_execution_confirmation enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.booking_execution_confirmation')).toBe(true)
    expect(isBookingExecutionConfirmationEnabled()).toBe(true)
    expect(BOOKING_EXECUTION_CONFIRMATION_FEATURE_ID).toBe('ai.booking_execution_confirmation')
    expect(SPRINT102_BOOKING_EXECUTION_VERSION).toMatch(/booking-execution-confirmation/)
  })

  describe('review model', () => {
    it('builds itinerary, pricing, taxes, and cancellation policy', () => {
      const model = buildBookingReviewModel(sampleCompose())
      expect(model.itinerary?.destination).toBe('Dubai')
      expect(model.itinerary?.flightLabel).toMatch(/Saudia/)
      expect(model.pricing?.taxes).toBe(400)
      expect(model.pricing?.total).toBe(3600)
      expect(model.cancellationPolicy?.refundable).toBe(true)
    })

    it('hides missing pricing / policy sections', () => {
      const model = buildBookingReviewModel({
        destination: 'Dubai',
      })
      expect(model.itinerary).not.toBeNull()
      expect(model.pricing).toBeNull()
      expect(model.cancellationPolicy).toBeNull()
    })
  })

  describe('traveler confirmation', () => {
    it('fails validation when required fields are missing', () => {
      const result = validateTravelerConfirmation([createEmptyTraveler('t1')])
      expect(result.ok).toBe(false)
      expect(result.missingFields).toContain('firstName')
      expect(result.missingFields).toContain('passportNumber')
    })

    it('passes when required fields are present', () => {
      expect(validateTravelerConfirmation([completeTraveler()]).ok).toBe(true)
    })
  })

  describe('lifecycle', () => {
    it('supports pending → confirmed / failed / cancelled', () => {
      const pending = createPendingLifecycle()
      expect(pending.status).toBe('pending')
      expect(transitionLifecycle(pending, 'confirmed').status).toBe('confirmed')
      expect(transitionLifecycle(pending, 'failed', { error: 'x' }).status).toBe('failed')
      expect(transitionLifecycle(pending, 'cancelled').status).toBe('cancelled')
    })
  })

  describe('book now via abstract adapter', () => {
    it('confirms through stub adapter and builds confirmation model', async () => {
      let experience = composeBookingExecutionReview(sampleCompose())
      experience = advanceToTravelerConfirmation(experience, [completeTraveler()])
      expect(experience.travelerValidation?.ok).toBe(true)

      const next = await executeBookNow(experience, {
        compose: sampleCompose(),
        travelers: [completeTraveler()],
        adapter: createStubBookingProviderAdapter(),
      })

      expect(next.step).toBe('confirmation')
      expect(next.lifecycle.status).toBe('confirmed')
      expect(next.confirmation?.bookingReference).toMatch(/^RHL-BK-/)
      expect(next.confirmation?.pnrPlaceholder).toMatch(/^PNR-PENDING-/)
      expect(next.confirmation?.actions.canDownload).toBe(true)
      expect(next.confirmation?.actions.canShare).toBe(true)
    })

    it('marks failed when adapter fails', async () => {
      const experience = composeBookingExecutionReview(sampleCompose())
      const next = await executeBookNow(experience, {
        compose: sampleCompose(),
        travelers: [completeTraveler()],
        adapter: createStubBookingProviderAdapter({ forceFail: true }),
      })
      expect(next.lifecycle.status).toBe('failed')
      expect(next.confirmation).toBeNull()
      expect(next.bookNowResult?.ok).toBe(false)
    })

    it('blocks book now when travelers are incomplete', async () => {
      const experience = composeBookingExecutionReview(sampleCompose())
      const next = await executeBookNow(experience, {
        compose: sampleCompose(),
        travelers: [createEmptyTraveler()],
        adapter: createStubBookingProviderAdapter(),
      })
      expect(next.step).toBe('traveler_confirmation')
      expect(next.travelerValidation?.ok).toBe(false)
    })
  })

  describe('confirmation model', () => {
    it('includes reference, PNR placeholder, and share actions when confirmed', () => {
      const model = buildBookingConfirmationModel({
        bookingId: 'bx_1',
        bookingReference: 'RHL-BK-ABC',
        pnrPlaceholder: 'PNR-PENDING-ABC',
        lifecycle: transitionLifecycle(createPendingLifecycle(), 'confirmed'),
        itinerary: {
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-08-15',
          endDate: '2026-08-20',
          flightLabel: 'Saudia',
          hotelLabel: 'Marina',
          packageLabel: null,
          travelerCount: 1,
        },
        pricing: {
          baseFare: 3000,
          taxes: 400,
          fees: 200,
          total: 3600,
          currency: 'SAR',
          savings: 250,
        },
      })
      expect(model.bookingReference).toBe('RHL-BK-ABC')
      expect(model.pnrPlaceholder).toBe('PNR-PENDING-ABC')
      expect(model.actions.canDownload).toBe(true)
    })
  })

  describe('feature flag / bridge integration', () => {
    it('returns null when flag is off (legacy preserved)', () => {
      getFeatureRegistry().setEnabled('ai.booking_execution_confirmation', false)
      expect(isBookingExecutionConfirmationEnabled()).toBe(false)
      expect(startBookingExecutionReview({
        compose: sampleCompose(),
        enabled: false,
      })).toBeNull()
    })

    it('runs review → travelers → book now through bridge', async () => {
      const started = startBookingExecutionReview({
        compose: composeInputFromAssistantSnapshot({
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-08-15',
          flightLabel: 'Saudia',
          total: 3600,
          taxes: 400,
          currency: 'SAR',
          cancellationSummary: 'Refundable',
          refundable: true,
        }),
      })
      expect(started).not.toBeNull()
      const bookingId = started!.bookingId

      const validated = confirmTravelersForBooking(bookingId, [completeTraveler()])
      expect(validated?.travelerValidation?.ok).toBe(true)

      const booked = await bookNowForBooking({
        bookingId,
        compose: sampleCompose(),
        travelers: [completeTraveler()],
      })
      expect(booked?.lifecycle.status).toBe('confirmed')
      expect(booked?.confirmation?.bookingReference).toBeTruthy()
      expect(booked?.confirmation?.pnrPlaceholder).toMatch(/PNR-PENDING/)
    })
  })
})
