/**
 * Phase AG — Trip Planner API Layer v1 deterministic tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTripPlannerHttpHandler,
  createDevTokenAuthResolver,
  resetTripPlannerTestSingletons,
  createTripPlannerService,
  type TripPlannerRequest,
} from '../ai'
import { createTripPlannerApiClient } from '../../integrations/api/tripPlannerApiClient'
import { getDefaultPaymentProviderType } from '../payment'
import {
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
} from '../agent/aggregation'
import { resetSecurityRateLimits } from '../ops/security/securityPolicy'

function baseRequest(overrides: Partial<TripPlannerRequest> = {}): TripPlannerRequest {
  return {
    requestId: 'req_ag_1',
    userId: 'user_ag_1',
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
    idempotencyKey: 'idem_ag_1',
    ...overrides,
  }
}

describe('Phase AG — Trip Planner API Layer v1', () => {
  beforeEach(() => {
    resetTripPlannerTestSingletons()
    resetSecurityRateLimits()
  })

  it('serves health without auth and keeps mock/live safeguards', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0) },
      requireAuth: true,
    })
    const res = await handle(new Request('https://tp.local/health', { method: 'GET' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.service).toBe('trip-planner')
    expect(body.paymentProvider).toBe('mock')
    expect(body.liveProvidersEnabled).toBe(false)
    expect(body.bookingEnabled).toBe(false)
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(isLiveProviderFlagEnabled(resolveProviderFeatureFlags(), 'amadeus')).toBe(false)
  })

  it('requires authentication for plan', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan', request: baseRequest() }),
      }),
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('auth_error')
  })

  it('plans via thin handler → TripPlannerService (no second orchestration)', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0),
    })
    const handle = createTripPlannerHttpHandler({
      service,
      authResolver: createDevTokenAuthResolver(),
    })
    const res = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user:user_ag_1',
        },
        body: JSON.stringify({ action: 'plan', request: baseRequest() }),
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('x-correlation-id')).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.action).toBe('plan')
    expect(body.result.status).toBe('completed')
    expect(body.result.userId).toBe('user_ag_1')
    expect(body.result.recommendations.length).toBeGreaterThan(0)
    expect(body.result.itinerary).toBeTruthy()
    expect(body.result.pipelineTimeline.map((e: { stage: string }) => e.stage)).toContain(
      'Completed',
    )
  })

  it('rejects userId mismatches (authorization)', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user:user_ag_1',
        },
        body: JSON.stringify({
          action: 'plan',
          request: baseRequest({ userId: 'someone_else' }),
        }),
      }),
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('forbidden_user_mismatch')
  })

  it('returns stored results by idempotency key and enforces ownership', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0),
    })
    const handle = createTripPlannerHttpHandler({ service })
    await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user:user_ag_1',
        },
        body: JSON.stringify({
          action: 'plan',
          request: baseRequest({ idempotencyKey: 'idem_lookup' }),
        }),
      }),
    )

    const ok = await handle(
      new Request('https://tp.local/result?idempotencyKey=idem_lookup', {
        method: 'GET',
        headers: { Authorization: 'Bearer user:user_ag_1' },
      }),
    )
    expect(ok.status).toBe(200)
    const okBody = await ok.json()
    expect(okBody.result.requestId).toBe('req_ag_1')

    const forbidden = await handle(
      new Request('https://tp.local/result?idempotencyKey=idem_lookup', {
        method: 'GET',
        headers: { Authorization: 'Bearer user:other_user' },
      }),
    )
    expect(forbidden.status).toBe(404)
  })

  it('maps domain validation failures into TripPlannerResult without transport 4xx', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0) },
    })
    const res = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user:user_ag_1',
        },
        body: JSON.stringify({
          action: 'plan',
          request: baseRequest({
            startDate: '2027-05-10',
            endDate: '2027-05-01',
            idempotencyKey: 'idem_bad_dates',
            requestId: 'req_bad_dates',
          }),
        }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.status).toBe('failed')
    expect(body.result.failure.stage).toBe('Validating')
  })

  it('supports in-process API client end-to-end', async () => {
    const client = createTripPlannerApiClient({
      transport: 'in_process',
      handlerOptions: {
        serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0) },
      },
    })
    const health = await client.health()
    expect(health.ok).toBe(true)

    const planned = await client.plan(
      baseRequest({ idempotencyKey: 'idem_client', requestId: 'req_client' }),
    )
    expect(planned.ok).toBe(true)
    expect(planned.result?.status).toBe('completed')

    const stored = await client.getResult({
      idempotencyKey: 'idem_client',
      userId: 'user_ag_1',
    })
    expect(stored.ok).toBe(true)
    expect(stored.result?.requestId).toBe('req_client')
  })

  it('rejects invalid JSON and oversized bodies', async () => {
    const handle = createTripPlannerHttpHandler({
      maxRequestBytes: 64,
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 15, 0, 0) },
    })
    const badJson = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user:user_ag_1',
        },
        body: '{not-json',
      }),
    )
    expect(badJson.status).toBe(400)
    expect((await badJson.json()).code).toBe('invalid_body')

    const big = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer user:user_ag_1',
        },
        body: JSON.stringify({
          action: 'plan',
          request: baseRequest({ idempotencyKey: 'x'.repeat(200) }),
        }),
      }),
    )
    expect(big.status).toBe(413)
  })

  it('handles CORS preflight', async () => {
    const handle = createTripPlannerHttpHandler()
    const res = await handle(
      new Request('https://tp.local/plan', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Methods')).toMatch(/POST/)
  })
})
