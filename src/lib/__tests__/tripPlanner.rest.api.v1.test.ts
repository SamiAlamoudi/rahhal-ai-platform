/**
 * Phase AG — Trip Planner REST API Layer v1 deterministic tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTripPlannerHttpHandler,
  createTripPlannerService,
  progressForStage,
  progressFromTimeline,
  resetTripPlannerApiMetrics,
  resetTripPlannerTestSingletons,
  TripPlannerPlanStore,
  type TripPlannerRequest,
} from '../ai'
import { getDefaultPaymentProviderType } from '../payment'
import {
  isLiveProviderFlagEnabled,
  resolveProviderFeatureFlags,
} from '../agent/aggregation'
import { resetSecurityRateLimits } from '../ops/security/securityPolicy'
import { assertNoSecretsInText } from '../ops/logging/mask'
import { toTimelineDto } from '../ai/tripPlanner/http/dto'

function baseDto(overrides: Record<string, unknown> = {}) {
  return {
    destinations: ['Istanbul'],
    origin: 'Riyadh',
    startDate: '2027-05-01',
    endDate: '2027-05-05',
    durationDays: 5,
    travelers: { adults: 2, travelerType: 'couple' },
    budget: { amount: 9000, currency: 'SAR' },
    currency: 'SAR',
    travelStyle: 'cultural',
    preferredLanguage: 'en',
    includeBookingPreview: false,
    ...overrides,
  }
}

function auth(userId: string, admin = false): string {
  return admin ? `Bearer user:${userId}:admin` : `Bearer user:${userId}`
}

describe('Phase AG — Trip Planner REST API v1', () => {
  beforeEach(() => {
    resetTripPlannerTestSingletons()
    resetTripPlannerApiMetrics()
    resetSecurityRateLimits()
  })

  it('progress mapping is deterministic and reaches 100 without booking preview', () => {
    expect(progressForStage('Received', { includeBookingPreview: false })).toBe(5)
    expect(progressForStage('Validating', { includeBookingPreview: false })).toBe(10)
    expect(progressForStage('PreferencesPrepared', { includeBookingPreview: false })).toBe(25)
    expect(progressForStage('RecommendationsGenerated', { includeBookingPreview: false })).toBe(45)
    expect(progressForStage('ItineraryGenerated', { includeBookingPreview: false })).toBe(100)
    expect(progressForStage('BookingPreviewGenerated', { includeBookingPreview: true })).toBe(90)
    expect(progressForStage('Completed', { includeBookingPreview: false })).toBe(100)
    expect(
      progressForStage('Failed', {
        includeBookingPreview: true,
        lastCompletedProgress: 45,
      }),
    ).toBe(45)
    expect(
      progressFromTimeline(
        ['Received', 'Validating', 'PreferencesPrepared', 'RecommendationsGenerated', 'Failed'],
        true,
      ),
    ).toBe(45)
  })

  it('keeps mock payment and live providers off', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_rest_safe',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(res.status).toBe(201)
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(isLiveProviderFlagEnabled(resolveProviderFeatureFlags(), 'amadeus')).toBe(false)
  })

  it('requires authentication for plan creation', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHENTICATED')
  })

  it('creates an authenticated plan without booking preview (201 sync)', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_rest_ok',
          'x-correlation-id': 'corr-rest-001',
        },
        body: JSON.stringify(baseDto({ userId: 'attacker_should_be_ignored' })),
      }),
    )
    expect(res.status).toBe(201)
    expect(res.headers.get('x-correlation-id')).toBe('corr-rest-001')
    const body = await res.json()
    expect(body.planId).toBeTruthy()
    expect(body.status).toBe('completed')
    expect(body.progress).toBe(100)
    expect(body.result.userId).toBe('user_rest_1')
    expect(body.result.bookingPreview).toBeNull()
    expect(body.statusUrl).toContain('/status')
    expect(assertNoSecretsInText(JSON.stringify(body))).toBe(true)
  })

  it('creates a plan with mock booking preview', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_rest_preview',
        },
        body: JSON.stringify(baseDto({ includeBookingPreview: true })),
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.result.bookingPreview).toBeTruthy()
    expect(body.result.bookingPreview.paymentCaptured).toBe(false)
    expect(body.result.bookingPreview.bookingConfirmed).toBe(false)
    expect(body.result.bookingPreview.liveProvidersUsed).toBe(false)
    expect(body.progress).toBe(100)
  })

  it('supports asynchronous 202 accept + status polling', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
      afterReceived: () => gate,
    })
    const planStore = new TripPlannerPlanStore(service)
    const handle = createTripPlannerHttpHandler({ service, planStore })

    const createRes = await handle(
      new Request('https://tp.local/trip-planner/plans?async=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_rest_async',
          Prefer: 'respond-async',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(createRes.status).toBe(202)
    const created = await createRes.json()
    expect(created.planId).toBeTruthy()

    const statusRes = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}/status`, {
        method: 'GET',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(statusRes.status).toBe(200)
    const status = await statusRes.json()
    expect(['accepted', 'queued', 'running']).toContain(status.status)
    expect(status.planId).toBe(created.planId)
    expect(typeof status.progress).toBe('number')
    expect(status.correlationId).toBeTruthy()

    release()
    // Allow microtask pipeline to finish.
    await new Promise((r) => setTimeout(r, 20))

    const done = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}`, {
        method: 'GET',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(done.status).toBe(200)
    const result = await done.json()
    expect(result.status).toBe('completed')
  })

  it('enforces ownership with 404 (no existence leak) and allows admin', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const created = await (
      await handle(
        new Request('https://tp.local/trip-planner/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth('owner_1'),
            'Idempotency-Key': 'idem_own_1',
          },
          body: JSON.stringify(baseDto()),
        }),
      )
    ).json()

    const other = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}`, {
        method: 'GET',
        headers: { Authorization: auth('other_user') },
      }),
    )
    expect(other.status).toBe(404)
    expect((await other.json()).error.code).toBe('NOT_FOUND')

    const missing = await handle(
      new Request('https://tp.local/trip-planner/plans/00000000-0000-4000-8000-000000000099', {
        method: 'GET',
        headers: { Authorization: auth('other_user') },
      }),
    )
    expect(missing.status).toBe(404)

    const admin = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}`, {
        method: 'GET',
        headers: { Authorization: auth('admin_ops', true) },
      }),
    )
    expect(admin.status).toBe(200)
  })

  it('returns ordered timeline with masked metadata', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const created = await (
      await handle(
        new Request('https://tp.local/trip-planner/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth('user_rest_1'),
            'Idempotency-Key': 'idem_timeline',
          },
          body: JSON.stringify(baseDto()),
        }),
      )
    ).json()

    const timelineRes = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}/timeline`, {
        method: 'GET',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(timelineRes.status).toBe(200)
    const timeline = await timelineRes.json()
    expect(timeline.events.length).toBeGreaterThan(1)
    const times = timeline.events.map((e: { at: string }) => e.at)
    expect([...times].sort()).toEqual(times)

    const masked = toTimelineDto('p1', [
      {
        id: 'e1',
        stage: 'Received',
        at: '2026-07-15T00:00:00.000Z',
        message: 'ok',
        ok: true,
        details: {
          email: 'traveler@example.com',
          api_key: 'sk_live_should_redact',
          note: 'safe',
        },
      },
    ])
    expect(masked.events[0]!.details!.api_key).toBe('[redacted]')
    expect(String(masked.events[0]!.details!.email)).not.toContain('traveler@example.com')
  })

  it('cancels actively and is idempotent on repeat cancel', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
      afterReceived: () => gate,
    })
    const planStore = new TripPlannerPlanStore(service)
    const handle = createTripPlannerHttpHandler({ service, planStore })

    const created = await (
      await handle(
        new Request('https://tp.local/trip-planner/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth('user_rest_1'),
            'Idempotency-Key': 'idem_cancel',
            Prefer: 'respond-async',
          },
          body: JSON.stringify(baseDto()),
        }),
      )
    ).json()

    const cancel1 = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}/cancel`, {
        method: 'POST',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(cancel1.status).toBe(200)
    const c1 = await cancel1.json()
    expect(c1.status).toBe('cancelled')

    const cancel2 = await handle(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}/cancel`, {
        method: 'POST',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(cancel2.status).toBe(200)
    expect((await cancel2.json()).status).toBe('cancelled')

    release()
    await new Promise((r) => setTimeout(r, 20))
  })

  it('retryable failure can be retried; completed retry is rejected', async () => {
    let shouldFail = true
    const failing = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
      failStage: 'recommendations',
    })
    const succeeding = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
    })
    const facade = {
      plan: async (request: TripPlannerRequest, opts?: { signal?: AbortSignal }) => {
        if (shouldFail) {
          shouldFail = false
          return failing.plan(request, opts)
        }
        return succeeding.plan(request, opts)
      },
      getStoredResult: () => null,
      getResultByRequestId: () => null,
      clear: () => undefined,
    }
    const planStore = new TripPlannerPlanStore(facade as never)
    const handle = createTripPlannerHttpHandler({
      service: facade as never,
      planStore,
    })

    const failedRes = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_retry_ok',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    const failed = await failedRes.json()
    expect(failed.result?.failure?.retryable).toBe(true)

    const retryRes = await handle(
      new Request(`https://tp.local/trip-planner/plans/${failed.planId}/retry`, {
        method: 'POST',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(retryRes.status).toBe(200)
    const retried = await retryRes.json()
    expect(retried.status).toBe('completed')

    const retryCompleted = await handle(
      new Request(`https://tp.local/trip-planner/plans/${failed.planId}/retry`, {
        method: 'POST',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(retryCompleted.status).toBe(409)
  })

  it('rejects non-retryable validation failures on retry', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    // Force a stored non-retryable failure by creating via store with fail that maps validation —
    // API validates before create, so use service path: create valid then mark failure via forceTimeout? timeout is retryable.
    // Use invalid request that somehow... can't create invalid through REST (422 before store).
    // Seed store manually:
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
    })
    const planStore = new TripPlannerPlanStore(service)
    const handle2 = createTripPlannerHttpHandler({ service, planStore })

    // Create success then manually mutate to non-retryable failed (simulates stored state).
    const created = await (
      await handle2(
        new Request('https://tp.local/trip-planner/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth('user_rest_1'),
            'Idempotency-Key': 'idem_nonretry',
          },
          body: JSON.stringify(baseDto()),
        }),
      )
    ).json()

    const plan = planStore.get(created.planId)!
    plan.status = 'failed'
    plan.currentStage = 'Failed'
    plan.active = false
    plan.result = {
      ...plan.result!,
      status: 'failed',
      stage: 'Failed',
      failure: {
        stage: 'Validating',
        code: 'invalid_travel_dates',
        message: 'bad',
        retryable: false,
        correlationId: plan.correlationId,
      },
      validationErrors: [{ code: 'invalid_travel_dates', message: 'bad', field: 'travelDates' }],
    }

    const retry = await handle2(
      new Request(`https://tp.local/trip-planner/plans/${created.planId}/retry`, {
        method: 'POST',
        headers: { Authorization: auth('user_rest_1') },
      }),
    )
    expect(retry.status).toBe(409)
    void handle
  })

  it('rejects invalid JSON, oversized body, invalid dates/budget/currency', async () => {
    const handle = createTripPlannerHttpHandler({
      maxRequestBytes: 128,
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })

    const badJson = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
        },
        body: '{not-json',
      }),
    )
    expect(badJson.status).toBe(400)
    expect((await badJson.json()).error.code).toBe('INVALID_JSON')

    const big = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_big_body_01',
        },
        body: JSON.stringify(baseDto({ destinations: ['X'.repeat(200)] })),
      }),
    )
    expect(big.status).toBe(400)
    expect((await big.json()).error.code).toBe('REQUEST_TOO_LARGE')

    const handleFull = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })

    const dates = await handleFull(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_bad_dates',
        },
        body: JSON.stringify(
          baseDto({ startDate: '2027-05-10', endDate: '2027-05-01' }),
        ),
      }),
    )
    expect(dates.status).toBe(422)
    expect((await dates.json()).error.code).toBe('INVALID_TRAVEL_DATES')

    const budget = await handleFull(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_bad_budget',
        },
        body: JSON.stringify(baseDto({ budget: { amount: -5, currency: 'SAR' } })),
      }),
    )
    expect(budget.status).toBe(422)
    expect((await budget.json()).error.code).toBe('INVALID_BUDGET')

    const currency = await handleFull(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_bad_currency',
        },
        body: JSON.stringify(baseDto({ currency: 'JPY' })),
      }),
    )
    expect(currency.status).toBe(422)
    expect((await currency.json()).error.code).toBe('UNSUPPORTED_CURRENCY')
  })

  it('localizes validation errors to Arabic and English', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })

    const en = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_lang_en',
          'Accept-Language': 'en',
        },
        body: JSON.stringify(baseDto({ destinations: [] })),
      }),
    )
    expect(en.status).toBe(422)
    const enBody = await en.json()
    expect(enBody.error.code).toBe('MISSING_DESTINATION')
    expect(enBody.error.message.toLowerCase()).toContain('destination')

    const ar = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_lang_ar',
          'Accept-Language': 'ar',
        },
        body: JSON.stringify(baseDto({ destinations: [], preferredLanguage: 'ar' })),
      }),
    )
    expect(ar.status).toBe(422)
    const arBody = await ar.json()
    expect(arBody.error.code).toBe('MISSING_DESTINATION')
    expect(arBody.error.message).toMatch(/وجهة|يلزم/)
  })

  it('idempotency: same key+body replays; same key+different body conflicts', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const headers = {
      'Content-Type': 'application/json',
      Authorization: auth('user_rest_1'),
      'Idempotency-Key': 'idem_same_key',
    }
    const first = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers,
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(first.status).toBe(201)
    const firstBody = await first.json()

    const replay = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers,
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(replay.status).toBe(201)
    const replayBody = await replay.json()
    expect(replayBody.planId).toBe(firstBody.planId)

    const conflict = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers,
        body: JSON.stringify(baseDto({ destinations: ['Paris'] })),
      }),
    )
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).error.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('detects duplicate active request', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
      afterReceived: () => gate,
    })
    const planStore = new TripPlannerPlanStore(service)
    const handle = createTripPlannerHttpHandler({ service, planStore })

    const a = handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_dup_a',
          Prefer: 'respond-async',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    const first = await a
    expect(first.status).toBe(202)

    const second = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_dup_b',
          Prefer: 'respond-async',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(second.status).toBe(409)
    expect((await second.json()).error.code).toBe('DUPLICATE_ACTIVE')
    release()
    await new Promise((r) => setTimeout(r, 20))
  })

  it('rate limits status polling', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
    })
    const planStore = new TripPlannerPlanStore(service)
    const handle = createTripPlannerHttpHandler({ service, planStore })
    const createRes = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rl'),
          'Idempotency-Key': 'idem_rl_status_01',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.planId).toBeTruthy()
    expect(planStore.get(created.planId)).toBeTruthy()

    let limited = false
    for (let i = 0; i < 130; i += 1) {
      const res = await handle(
        new Request(`https://tp.local/trip-planner/plans/${created.planId}/status`, {
          method: 'GET',
          headers: { Authorization: auth('user_rl') },
        }),
      )
      if (res.status === 429) {
        limited = true
        expect((await res.json()).error.code).toBe('RATE_LIMITED')
        break
      }
      expect(res.status).toBe(200)
    }
    expect(limited).toBe(true)
  })

  it('maps timeout to 504', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
      forceTimeoutStage: 'RecommendationsGenerated',
    })
    const planStore = new TripPlannerPlanStore(service)
    const handle = createTripPlannerHttpHandler({ service, planStore })
    const res = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_timeout',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.error?.code ?? body.result?.failure?.code).toMatch(/TIMEOUT|timeout/i)
  })

  it('returns partial results when later stage fails', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: {
        clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
        failStage: 'itinerary',
      },
    })
    const res = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_partial',
        },
        body: JSON.stringify(baseDto()),
      }),
    )
    const body = await res.json()
    const result = body.result ?? body
    expect(result.recommendations?.length ?? 0).toBeGreaterThan(0)
    expect(result.partial === true || result.status === 'partial' || result.status === 'failed').toBe(
      true,
    )
  })

  it('propagates correlation id and rejects payment mass-assignment', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
    })
    const pay = await handle(
      new Request('https://tp.local/trip-planner/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
          'Idempotency-Key': 'idem_pay',
          'x-correlation-id': 'corr-pay-1',
        },
        body: JSON.stringify({
          ...baseDto(),
          payment: { cardNumber: '4111111111111111', cvv: '123' },
        }),
      }),
    )
    expect(pay.status).toBe(400)
    expect(pay.headers.get('x-correlation-id')).toBe('corr-pay-1')
  })

  it('remains backward compatible with TripPlannerService + legacy /plan', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
    })
    const direct = await service.plan({
      requestId: 'req_compat',
      userId: 'user_rest_1',
      destinations: ['Istanbul'],
      origin: 'Riyadh',
      startDate: '2027-05-01',
      endDate: '2027-05-05',
      travelers: { adults: 2 },
      currency: 'SAR',
      includeBookingPreview: false,
      idempotencyKey: 'idem_compat_direct',
    })
    expect(direct.status).toBe('completed')

    const handle = createTripPlannerHttpHandler({ service })
    const legacy = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth('user_rest_1'),
        },
        body: JSON.stringify({
          action: 'plan',
          request: {
            requestId: 'req_compat_legacy',
            userId: 'user_rest_1',
            destinations: ['Istanbul'],
            origin: 'Riyadh',
            startDate: '2027-05-01',
            endDate: '2027-05-05',
            travelers: { adults: 2 },
            currency: 'SAR',
            includeBookingPreview: false,
            idempotencyKey: 'idem_compat_legacy',
          },
        }),
      }),
    )
    expect(legacy.status).toBe(200)
    const legacyBody = await legacy.json()
    expect(legacyBody.ok).toBe(true)
    expect(legacyBody.result.status).toBe('completed')
  })
})
