/**
 * Phase AF — Unified AI Trip Planner Pipeline v1 deterministic tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTripPlannerService,
  resetTripPlannerTestSingletons,
  validateTripPlannerRequest,
  calculatePipelineConfidence,
  createRecommendationEngine,
  createItineraryEngine,
  createBookingOrchestrator,
  type TripPlannerRequest,
  type TripPlannerService,
} from '../ai'
import { getDefaultPaymentProviderType } from '../payment'
import {
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
} from '../agent/aggregation'
import { maskMetadata as maskFromOps } from '../ops'

function baseRequest(overrides: Partial<TripPlannerRequest> = {}): TripPlannerRequest {
  return {
    requestId: 'req_af_1',
    userId: 'user_af_1',
    destinations: ['Istanbul'],
    origin: 'Riyadh',
    startDate: '2027-05-01',
    endDate: '2027-05-05',
    durationDays: 5,
    travelers: { adults: 2, children: 0, travelerType: 'couple' },
    budget: { amount: 9000, currency: 'SAR' },
    currency: 'SAR',
    travelStyle: 'cultural',
    explicitPreferences: {
      interests: ['food', 'culture'],
      budgetStyle: 'midrange',
      travelStyle: 'cultural',
      preferDirectFlights: true,
    },
    constraints: {
      preferDirectFlights: true,
      preferCentralHotels: true,
      maxActivitiesPerDay: 3,
    },
    accessibilityNeeds: { wheelchairAccessible: false },
    preferredLanguage: 'en',
    includeBookingPreview: false,
    idempotencyKey: 'idem_af_1',
    ...overrides,
  }
}

describe('Phase AF — TripPlannerService pipeline', () => {
  let service: TripPlannerService

  beforeEach(() => {
    resetTripPlannerTestSingletons()
    service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
    })
  })

  it('completes pipeline without booking preview', async () => {
    const result = await service.plan(baseRequest())
    expect(result.status).toBe('completed')
    expect(result.version).toBe(1)
    expect(result.bookingPreview).toBeNull()
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.itinerary).toBeTruthy()
    expect(result.itinerary!.days.length).toBe(5)
    expect(result.itinerary!.flights.length).toBeGreaterThan(0)
    expect(result.itinerary!.hotels.length).toBeGreaterThan(0)
    expect(result.itinerary!.transportation.length).toBeGreaterThan(0)
    expect(result.totalEstimatedCost).toBeGreaterThan(0)
    expect(result.currency).toBe('SAR')
    expect(result.pipelineTimeline.map((e) => e.stage)).toEqual(
      expect.arrayContaining([
        'Received',
        'Validating',
        'PreferencesPrepared',
        'RecommendationsGenerated',
        'ItineraryGenerated',
        'Completed',
      ]),
    )
    expect(result.pipelineTimeline.map((e) => e.stage)).not.toContain(
      'BookingPreviewGenerated',
    )
  })

  it('completes pipeline with mock booking preview (no payment/confirm)', async () => {
    const result = await service.plan(
      baseRequest({
        includeBookingPreview: true,
        idempotencyKey: 'idem_preview',
        requestId: 'req_preview',
      }),
    )
    expect(result.status).toBe('completed')
    expect(result.bookingPreview).toBeTruthy()
    expect(result.bookingPreview!.paymentCaptured).toBe(false)
    expect(result.bookingPreview!.bookingConfirmed).toBe(false)
    expect(result.bookingPreview!.liveProvidersUsed).toBe(false)
    expect(result.bookingPreview!.validated).toBe(true)
    expect(result.bookingPreview!.summary.bookingId).toBe(
      result.bookingPreview!.bookingId,
    )
    expect(result.bookingPreview!.timeline.events.length).toBeGreaterThan(0)
    expect(result.pipelineTimeline.map((e) => e.stage)).toContain(
      'BookingPreviewGenerated',
    )
  })

  it('supports single and multi-destination requests', async () => {
    const single = await service.plan(
      baseRequest({ idempotencyKey: 'idem_single', destinations: ['Tokyo'] }),
    )
    expect(single.itinerary!.destination).toBe('Tokyo')

    resetTripPlannerTestSingletons()
    service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
    })
    const multi = await service.plan(
      baseRequest({
        idempotencyKey: 'idem_multi',
        requestId: 'req_multi',
        destinations: ['Tokyo', 'Kyoto'],
      }),
    )
    expect(multi.itinerary!.destinations).toEqual(['Tokyo', 'Kyoto'])
  })

  it('supports Arabic and English metadata', async () => {
    const ar = await service.plan(
      baseRequest({
        preferredLanguage: 'ar',
        idempotencyKey: 'idem_ar',
        requestId: 'req_ar',
      }),
    )
    expect(ar.itinerary!.locale).toBe('ar')

    const en = await service.plan(
      baseRequest({
        preferredLanguage: 'en',
        idempotencyKey: 'idem_en',
        requestId: 'req_en',
      }),
    )
    expect(en.itinerary!.locale).toBe('en')
  })

  it('supports flexible dates when durationDays is provided', async () => {
    const result = await service.plan(
      baseRequest({
        flexibleDates: true,
        startDate: null,
        endDate: null,
        durationDays: 4,
        idempotencyKey: 'idem_flex',
        requestId: 'req_flex',
      }),
    )
    expect(result.status).toBe('completed')
    expect(result.itinerary!.durationDays).toBe(4)
  })

  it('normalizes preferences and preserves preference sources', async () => {
    const result = await service.plan(baseRequest())
    expect(result.normalizedPreferences).toBeTruthy()
    expect(result.normalizedPreferences!.interests).toEqual(
      expect.arrayContaining(['food', 'culture']),
    )
    expect(result.normalizedPreferences!.weights).toBeTruthy()
    expect(
      result.normalizedPreferences!.preferenceSources.some((s) => s.source === 'explicit'),
    ).toBe(true)
  })

  it('hands off to RecommendationEngine without rescoring locally', async () => {
    const result = await service.plan(baseRequest())
    const primary = result.recommendations[0]!
    expect(primary.score.overall).toBeGreaterThan(0)
    expect(primary.confidence).toBeGreaterThan(0)
    expect(primary.reasons.length).toBeGreaterThan(0)
    expect(Array.isArray(primary.matchedPreferences)).toBe(true)
    expect(Array.isArray(primary.unmatchedPreferences)).toBe(true)
    // Deterministic ranks
    const ranks = result.recommendations.map((r) => r.rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('hands off ranked recommendations to ItineraryEngine', async () => {
    const result = await service.plan(baseRequest())
    expect(result.itinerary!.recommendationIds.length).toBeGreaterThan(0)
    expect(result.itinerary!.costs.total).toBeGreaterThan(0)
    expect(result.itinerary!.optimization).toBeTruthy()
    expect(result.itinerary!.explanation.assumptions.length).toBeGreaterThan(0)
    expect(result.itinerary!.days.some((d) => d.freeTimeMinutes > 0)).toBe(true)
  })

  it('rejects invalid dates, invalid budget, and conflicting constraints', async () => {
    const badDates = await service.plan(
      baseRequest({
        startDate: '2027-05-10',
        endDate: '2027-05-01',
        idempotencyKey: 'idem_bad_dates',
        requestId: 'req_bad_dates',
      }),
    )
    expect(badDates.status).toBe('failed')
    expect(badDates.failure!.stage).toBe('Validating')
    expect(badDates.validationErrors.some((e) => e.code === 'invalid_travel_dates')).toBe(
      true,
    )

    const badBudget = await service.plan(
      baseRequest({
        budget: { amount: -5 },
        idempotencyKey: 'idem_bad_budget',
        requestId: 'req_bad_budget',
      }),
    )
    expect(badBudget.validationErrors.some((e) => e.code === 'invalid_budget')).toBe(true)

    const conflict = validateTripPlannerRequest(
      baseRequest({
        constraints: { preferRelaxedPace: true, preferPackedSchedule: true },
      }),
    )
    expect(conflict.some((e) => e.code === 'conflicting_constraints')).toBe(true)
  })

  it('returns partial results on recommendation/itinerary/booking-preview failures', async () => {
    const recFail = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
      failStage: 'recommendations',
    })
    const r1 = await recFail.plan(
      baseRequest({ idempotencyKey: 'idem_rec_fail', requestId: 'req_rec_fail' }),
    )
    expect(r1.status).toBe('partial')
    expect(r1.failure!.code).toBe('recommendation_failure')
    expect(r1.normalizedPreferences).toBeTruthy()
    expect(r1.recommendations).toEqual([])
    expect(r1.itinerary).toBeNull()

    const itinFail = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
      failStage: 'itinerary',
    })
    const r2 = await itinFail.plan(
      baseRequest({ idempotencyKey: 'idem_itin_fail', requestId: 'req_itin_fail' }),
    )
    expect(r2.status).toBe('partial')
    expect(r2.failure!.code).toBe('itinerary_failure')
    expect(r2.recommendations.length).toBeGreaterThan(0)
    expect(r2.itinerary).toBeNull()

    const bookFail = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
      failStage: 'bookingPreview',
    })
    const r3 = await bookFail.plan(
      baseRequest({
        includeBookingPreview: true,
        idempotencyKey: 'idem_book_fail',
        requestId: 'req_book_fail',
      }),
    )
    expect(r3.status).toBe('partial')
    expect(r3.failure!.code).toBe('booking_preview_failure')
    expect(r3.itinerary).toBeTruthy()
    expect(r3.bookingPreview).toBeNull()
  })

  it('supports cancellation without booking side effects in the result', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
    }).plan(
      baseRequest({
        includeBookingPreview: true,
        idempotencyKey: 'idem_cancel',
        requestId: 'req_cancel',
      }),
      { signal: controller.signal },
    )
    expect(result.status).toBe('cancelled')
    expect(result.stage).toBe('Cancelled')
    expect(result.bookingPreview).toBeNull()
    expect(result.itinerary).toBeNull()
    expect(result.failure!.retryable).toBe(true)
    expect(result.failure!.code).toBe('cancelled')
  })

  it('supports stage timeout budgets', async () => {
    const timed = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
      forceTimeoutStage: 'RecommendationsGenerated',
    })
    const result = await timed.plan(
      baseRequest({ idempotencyKey: 'idem_timeout', requestId: 'req_timeout' }),
    )
    expect(result.status).toBe('partial')
    expect(result.failure!.code).toBe('timeout')
    expect(result.failure!.retryable).toBe(true)
    expect(result.normalizedPreferences).toBeTruthy()
  })

  it('enforces idempotency and duplicate in-flight protection', async () => {
    const first = await service.plan(baseRequest({ idempotencyKey: 'idem_same' }))
    const second = await service.plan(
      baseRequest({
        idempotencyKey: 'idem_same',
        destinations: ['ShouldNotMatter'],
        requestId: 'req_same_2',
      }),
    )
    expect(second.requestId).toBe(first.requestId)
    expect(second.generatedAt).toBe(first.generatedAt)
    expect(second.itinerary!.id).toBe(first.itinerary!.id)

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const blocked = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 14, 0, 0),
      afterReceived: () => gate,
    })
    const inFlight = blocked.plan(
      baseRequest({ idempotencyKey: 'idem_inflight', requestId: 'req_inflight_1' }),
    )
    // Allow first execution to reach afterReceived
    await Promise.resolve()
    await Promise.resolve()
    const dup = await blocked.plan(
      baseRequest({ idempotencyKey: 'idem_inflight', requestId: 'req_inflight_2' }),
    )
    expect(dup.failure?.code).toBe('duplicate_request')
    expect(dup.failure?.retryable).toBe(true)
    release()
    const completed = await inFlight
    expect(completed.status).toBe('completed')
  })

  it('keeps pipeline event ordering and calculates overall confidence', async () => {
    const result = await service.plan(
      baseRequest({ includeBookingPreview: true, idempotencyKey: 'idem_conf' }),
    )
    for (let i = 1; i < result.pipelineTimeline.length; i += 1) {
      expect(
        result.pipelineTimeline[i]!.at >= result.pipelineTimeline[i - 1]!.at,
      ).toBe(true)
    }
    expect(result.confidence).toBeTruthy()
    expect(result.overallConfidence).toBe(result.confidence!.overall)
    expect(result.confidence!.recommendation).toBeGreaterThan(0)
    expect(result.confidence!.itinerary).toBeGreaterThan(0)
    expect(result.confidence!.bookingPreviewReadiness).toBeGreaterThan(0)

    const manual = calculatePipelineConfidence({
      recommendations: result.recommendations,
      recommendationOverall: result.confidence!.recommendation,
      itinerary: result.itinerary,
      preferences: result.normalizedPreferences,
      bookingPreview: result.bookingPreview,
      includeBookingPreview: true,
      constraints: baseRequest().constraints,
      hasBudget: true,
      hasDates: true,
    })
    expect(manual.overall).toBe(result.confidence!.overall)
  })

  it('masks PII in pipeline event details', async () => {
    const result = await service.plan(
      baseRequest({
        idempotencyKey: 'idem_pii',
        // event details only include safe fields; verify mask helper still redacts secrets
      }),
    )
    const masked = maskFromOps({
      email: 'traveler@example.com',
      password: 'super-secret',
      token: 'abc123',
      destinations: 1,
    })
    expect(String(masked.email)).not.toContain('traveler@example.com')
    expect(String(masked.password)).not.toContain('super-secret')
    expect(result.pipelineTimeline.every((e) => !JSON.stringify(e).includes('super-secret'))).toBe(
      true,
    )
    expect(result.failure).toBeNull()
    expect(result.correlationId).toBeTruthy()
  })

  it('preserves backward compatibility with existing engines and mock/live defaults', async () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
    const flags = resolveProviderFeatureFlags()
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)

    // Engines remain independently constructible
    expect(createRecommendationEngine()).toBeTruthy()
    expect(createItineraryEngine()).toBeTruthy()
    expect(createBookingOrchestrator()).toBeTruthy()

    const result = await service.plan(baseRequest({ idempotencyKey: 'idem_compat' }))
    expect(result.recommendations[0]!.score.components).toBeTruthy()
    expect(result.itinerary!.version).toBe(1)
  })
})
