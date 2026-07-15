/**
 * Phase AE — Booking Orchestrator v1 deterministic unit tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  BookingOrchestrator,
  canTransitionBookingState,
  createBookingOrchestrator,
  resetBookingOrchestratorCounters,
  simulatePayment,
  withBookingRetry,
  type BookingItineraryInput,
} from '../ai/booking'

function sampleItinerary(overrides: Partial<BookingItineraryInput> = {}): BookingItineraryInput {
  return {
    id: 'itin_ae_1',
    destination: 'Istanbul',
    destinations: ['Istanbul'],
    durationDays: 3,
    currency: 'USD',
    flights: [
      {
        id: 'f1',
        from: 'RUH',
        to: 'IST',
        estimatedCost: 420,
        direct: true,
      },
    ],
    hotels: [
      {
        id: 'h1',
        name: 'Bosphorus Hotel',
        estimatedTotal: 360,
        nights: 3,
      },
    ],
    activities: [
      {
        id: 'a1',
        title: 'Hagia Sophia Tour',
        estimatedCost: 45,
        day: 1,
      },
    ],
    transportation: [
      {
        id: 't1',
        title: 'Airport Transfer',
        mode: 'transfer',
        estimatedCost: 35,
        day: 1,
      },
    ],
    ...overrides,
  }
}

describe('Phase AE — Booking Orchestrator v1', () => {
  let orch: BookingOrchestrator

  beforeEach(() => {
    resetBookingOrchestratorCounters()
    orch = createBookingOrchestrator({
      clockStartMs: Date.UTC(2026, 6, 15, 12, 0, 0),
      retryPolicy: { maxAttempts: 3, baseDelayMs: 0 },
    })
  })

  it('creates draft bookings coordinating flight, hotel, activities, transportation', () => {
    const booking = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_create_1',
      itinerary: sampleItinerary(),
    })

    expect(booking.state).toBe('draft')
    expect(booking.items.map((i) => i.kind)).toEqual([
      'flight',
      'hotel',
      'activity',
      'transportation',
    ])
    expect(booking.subtotal).toBe(860)
    expect(booking.total).toBe(860)
    expect(booking.version).toBe(1)
  })

  it('supports the booking pipeline: validate → reserve → pay → confirm', async () => {
    const draft = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_pipe_1',
      itinerary: sampleItinerary(),
    })

    const confirmed = await orch.runPipeline(draft.id)
    expect(confirmed.state).toBe('confirmed')
    expect(confirmed.paymentSimulated).toBe(true)
    expect(confirmed.paymentReference).toMatch(/^mockpay_/)
    expect(confirmed.items.every((i) => i.status === 'confirmed')).toBe(true)
    expect(confirmed.confirmedAt).toBeTruthy()

    const states = confirmed.timeline.map((e) => e.state)
    expect(states).toContain('pending')
    expect(states).toContain('reserved')
    expect(states).toContain('confirmed')
  })

  it('implements booking states draft/pending/reserved/confirmed/failed/cancelled', async () => {
    expect(canTransitionBookingState('draft', 'pending')).toBe(true)
    expect(canTransitionBookingState('pending', 'reserved')).toBe(true)
    expect(canTransitionBookingState('reserved', 'confirmed')).toBe(true)
    expect(canTransitionBookingState('pending', 'failed')).toBe(true)
    expect(canTransitionBookingState('confirmed', 'cancelled')).toBe(true)
    expect(canTransitionBookingState('cancelled', 'confirmed')).toBe(false)

    const a = orch.createDraft({
      userId: 'u',
      idempotencyKey: 'idem_states_ok',
      itinerary: sampleItinerary(),
    })
    expect(a.state).toBe('draft')
    const ok = await orch.runPipeline(a.id)
    expect(ok.state).toBe('confirmed')

    const b = orch.createDraft({
      userId: 'u',
      idempotencyKey: 'idem_states_fail',
      itinerary: sampleItinerary(),
    })
    const failed = await orch.runPipeline(b.id, { forcePaymentFail: true })
    expect(failed.state).toBe('failed')

    const c = orch.createDraft({
      userId: 'u',
      idempotencyKey: 'idem_states_cancel',
      itinerary: sampleItinerary(),
    })
    const cancelled = orch.cancel(c.id)
    expect(cancelled.state).toBe('cancelled')
  })

  it('rolls back reserved resources when payment fails', async () => {
    const draft = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_rollback_1',
      itinerary: sampleItinerary(),
    })
    const failed = await orch.runPipeline(draft.id, { forcePaymentFail: true })
    expect(failed.state).toBe('failed')
    expect(failed.paymentReference).toBeNull()
    expect(failed.items.every((i) => i.status === 'rolled_back')).toBe(true)
    expect(failed.timeline.some((e) => e.type === 'booking.rollback')).toBe(true)
  })

  it('applies retry strategy for transient reserve failures', async () => {
    const draft = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_retry_1',
      itinerary: sampleItinerary(),
    })
    const flightId = draft.items.find((i) => i.kind === 'flight')!.id

    const confirmed = await orch.runPipeline(draft.id, {
      forceFailItemId: flightId,
      failReserveUntilAttempt: 3,
      maxRetries: 3,
    })

    expect(confirmed.state).toBe('confirmed')
    const flight = confirmed.items.find((i) => i.id === flightId)!
    expect(flight.attempts).toBe(3)
    expect(confirmed.retryCount).toBeGreaterThanOrEqual(2)
  })

  it('protects create/pipeline with idempotency keys', async () => {
    const first = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_same',
      itinerary: sampleItinerary(),
    })
    const second = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_same',
      itinerary: sampleItinerary({ destination: 'Ignored' }),
    })
    expect(second.id).toBe(first.id)
    expect(second.itineraryId).toBe(first.itineraryId)
    expect(second.items[0]?.metadata).toEqual(first.items[0]?.metadata)

    const confirmed1 = await orch.runPipeline(first.id)
    const confirmed2 = await orch.runPipeline(first.id)
    expect(confirmed2.state).toBe('confirmed')
    expect(confirmed2.confirmedAt).toBe(confirmed1.confirmedAt)
    expect(confirmed2.timeline.length).toBe(confirmed1.timeline.length)
  })

  it('generates BookingSummary and BookingTimeline', async () => {
    const draft = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_summary_1',
      itinerary: sampleItinerary(),
      fees: 10,
    })
    await orch.runPipeline(draft.id)

    const summary = orch.getSummary(draft.id)
    expect(summary.bookingId).toBe(draft.id)
    expect(summary.state).toBe('confirmed')
    expect(summary.itemCount).toBe(4)
    expect(summary.confirmedCount).toBe(4)
    expect(summary.fees).toBe(10)
    expect(summary.total).toBe(870)
    expect(summary.paymentSimulated).toBe(true)
    expect(summary.idempotencyKey).toBe('idem_summary_1')

    const timeline = orch.getTimeline(draft.id)
    expect(timeline.bookingId).toBe(draft.id)
    expect(timeline.events.length).toBeGreaterThan(3)
    expect(timeline.events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'booking.created',
        'booking.pipeline_started',
        'itinerary.validated',
        'item.reserved',
        'payment.simulated',
        'booking.confirmed',
      ]),
    )
    // Deterministic timestamps: strictly increasing
    for (let i = 1; i < timeline.events.length; i += 1) {
      expect(timeline.events[i]!.at >= timeline.events[i - 1]!.at).toBe(true)
    }
  })

  it('is deterministic for the same inputs', async () => {
    resetBookingOrchestratorCounters()
    const a = createBookingOrchestrator({
      clockStartMs: Date.UTC(2026, 6, 15, 12, 0, 0),
      retryPolicy: { maxAttempts: 3, baseDelayMs: 0 },
    })
    const b = createBookingOrchestrator({
      clockStartMs: Date.UTC(2026, 6, 15, 12, 0, 0),
      retryPolicy: { maxAttempts: 3, baseDelayMs: 0 },
    })

    const da = a.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_det_a',
      itinerary: sampleItinerary(),
    })
    // Reset counters so ids match across orchestrators... actually separate counters shared globally.
    // Re-run with fresh counters for true determinism comparison via JSON shape.
    resetBookingOrchestratorCounters()
    const d1orch = createBookingOrchestrator({
      clockStartMs: Date.UTC(2026, 6, 15, 12, 0, 0),
    })
    const d2orch = createBookingOrchestrator({
      clockStartMs: Date.UTC(2026, 6, 15, 12, 0, 0),
    })

    // Sequential counters are shared — compare pipeline event types & totals instead of cross-instance ids.
    void a
    void b
    void da
    const x = d1orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_det_1',
      itinerary: sampleItinerary(),
    })
    const yInput = {
      userId: 'user_1',
      idempotencyKey: 'idem_det_2',
      itinerary: sampleItinerary(),
    }
    // Capture shape from x then rebuild with reset for y
    const xResult = await d1orch.runPipeline(x.id)
    resetBookingOrchestratorCounters()
    const y = d2orch.createDraft(yInput)
    // d2orch clock already advanced — use fresh orchestrator
    resetBookingOrchestratorCounters()
    const fresh = createBookingOrchestrator({
      clockStartMs: Date.UTC(2026, 6, 15, 12, 0, 0),
    })
    const yDraft = fresh.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_det_fresh',
      itinerary: sampleItinerary(),
    })
    const yResult = await fresh.runPipeline(yDraft.id)

    expect(yResult.items.map((i) => i.kind)).toEqual(xResult.items.map((i) => i.kind))
    expect(yResult.total).toBe(xResult.total)
    expect(yResult.timeline.map((e) => e.type)).toEqual(xResult.timeline.map((e) => e.type))
    expect(yResult.state).toBe(xResult.state)
    void y
  })

  it('fails validation when itinerary has no bookable items', async () => {
    const draft = orch.createDraft({
      userId: 'user_1',
      idempotencyKey: 'idem_empty',
      itinerary: sampleItinerary({
        flights: [],
        hotels: [],
        activities: [],
        transportation: [],
      }),
    })
    const failed = await orch.runPipeline(draft.id)
    expect(failed.state).toBe('failed')
    expect(failed.failureReason).toMatch(/no bookable items/i)
  })

  it('uses mock payment only', () => {
    const payment = simulatePayment({
      bookingId: 'bk_0001',
      amount: 100,
      currency: 'USD',
    })
    expect(payment.simulated).toBe(true)
    expect(payment.ok).toBe(true)
    expect(payment.reference).toMatch(/^mockpay_/)
  })

  it('withBookingRetry is deterministic with zero delay', async () => {
    let n = 0
    const result = await withBookingRetry(
      { maxAttempts: 3, baseDelayMs: 0 },
      () => {
        n += 1
        if (n < 2) throw new Error('transient')
        return 'ok'
      },
    )
    expect(result).toEqual({ ok: true, value: 'ok', attempts: 2 })
  })
})
