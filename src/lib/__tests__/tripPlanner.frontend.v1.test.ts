/**
 * Phase AH — Frontend Trip Planner Integration tests.
 * Covers API client flow, mapping, adaptation, polling, cancel, retry, auth errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTripPlannerApiClient,
  type TripPlannerApiClient,
} from '../../integrations/api/tripPlannerApiClient'
import {
  adaptReasoningMap,
  adaptTripPlannerResultToSearchOrchestration,
  createTripPlannerHttpHandler,
  createTripPlannerService,
  formatApiTransportError,
  localizeValidationErrors,
  mapTravelSessionToTripPlannerRequest,
  resetTripPlannerTestSingletons,
  runTripPlannerFlow,
  type TripPlannerResult,
} from '../ai'
import { createEmptyTravelSession, confirmDecisionProfile, type TravelSession } from '../../utils/travelSession'
import { resetSecurityRateLimits } from '../ops/security/securityPolicy'

function readySession(overrides: Partial<TravelSession> = {}): TravelSession {
  const base = createEmptyTravelSession()
  const filled: TravelSession = {
    ...base,
    destination: 'Istanbul',
    departureCity: 'Riyadh',
    departureDate: '2027-05-01',
    returnDate: '2027-05-05',
    durationDays: 5,
    adults: 2,
    children: 0,
    infants: 0,
    budgetAmount: 9000,
    budgetCurrency: 'SAR',
    tripPurpose: 'cultural',
    interests: 'food, culture',
    directFlightPreference: 'direct-preferred',
    flexibleDates: 'fixed',
    preferredHotelCategory: 'فندق 4 نجوم',
    ...overrides,
  }
  return confirmDecisionProfile(filled)
}

function createInProcessClient(service = createTripPlannerService({
  clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
})): TripPlannerApiClient {
  return createTripPlannerApiClient({
    transport: 'in_process',
    handlerOptions: { service },
  })
}

describe('Phase AH — Frontend Trip Planner Integration', () => {
  beforeEach(() => {
    resetTripPlannerTestSingletons()
    resetSecurityRateLimits()
  })

  it('maps destination, preferences, budget, and dates from TravelSession', () => {
    const session = readySession()
    const request = mapTravelSessionToTripPlannerRequest(session, {
      userId: 'user_ah_1',
      preferredLanguage: 'ar',
      includeBookingPreview: true,
    })
    expect(request.destinations).toEqual(['Istanbul'])
    expect(request.origin).toBe('Riyadh')
    expect(request.startDate).toBe('2027-05-01')
    expect(request.endDate).toBe('2027-05-05')
    expect(request.budget?.amount).toBe(9000)
    expect(request.travelers.adults).toBe(2)
    expect(request.explicitPreferences?.interests).toEqual(
      expect.arrayContaining(['food', 'culture']),
    )
    expect(request.includeBookingPreview).toBe(true)
    expect(request.preferredLanguage).toBe('ar')
    expect(request.userId).toBe('user_ah_1')
  })

  it('completes successful planning through the Trip Planner API client', async () => {
    const client = createInProcessClient()
    const request = mapTravelSessionToTripPlannerRequest(readySession(), {
      userId: 'user_ah_1',
      idempotencyKey: 'idem_ah_ok',
      requestId: 'req_ah_ok',
      includeBookingPreview: false,
    })
    const outcome = await runTripPlannerFlow({ client, request })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.status).toBe('completed')
    expect(outcome.result.recommendations.length).toBeGreaterThan(0)
    expect(outcome.result.itinerary).toBeTruthy()

    const orchestration = adaptTripPlannerResultToSearchOrchestration(outcome.result)
    expect(orchestration.rankedOptions.length).toBeGreaterThan(0)
    const reasoning = adaptReasoningMap(outcome.result)
    expect(reasoning.size).toBe(orchestration.rankedOptions.length)
    const first = orchestration.rankedOptions[0]!
    expect(reasoning.get(first.id)?.decisionExplanation.length).toBeGreaterThan(0)
  })

  it('supports booking preview via API includeBookingPreview', async () => {
    const client = createInProcessClient()
    const request = mapTravelSessionToTripPlannerRequest(readySession(), {
      userId: 'user_ah_1',
      idempotencyKey: 'idem_ah_preview',
      requestId: 'req_ah_preview',
      includeBookingPreview: true,
    })
    const outcome = await runTripPlannerFlow({ client, request })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.bookingPreview).toBeTruthy()
    expect(outcome.result.bookingPreview!.paymentCaptured).toBe(false)
    expect(outcome.result.bookingPreview!.bookingConfirmed).toBe(false)
  })

  it('returns partial results when itinerary stage fails', async () => {
    const client = createInProcessClient(
      createTripPlannerService({
        clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
        failStage: 'itinerary',
      }),
    )
    const request = mapTravelSessionToTripPlannerRequest(readySession(), {
      userId: 'user_ah_1',
      idempotencyKey: 'idem_ah_partial',
      requestId: 'req_ah_partial',
    })
    const outcome = await runTripPlannerFlow({ client, request })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.status).toBe('partial')
    expect(outcome.result.partial).toBe(true)
    expect(outcome.result.recommendations.length).toBeGreaterThan(0)
    expect(outcome.result.itinerary).toBeNull()
  })

  it('surfaces localized validation errors', async () => {
    const client = createInProcessClient()
    const request = mapTravelSessionToTripPlannerRequest(
      readySession({
        departureDate: '2027-05-10',
        returnDate: '2027-05-01',
      }),
      {
        userId: 'user_ah_1',
        idempotencyKey: 'idem_ah_dates',
        requestId: 'req_ah_dates',
      },
    )
    const outcome = await runTripPlannerFlow({ client, request })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.status).toBe('failed')
    const ar = localizeValidationErrors(outcome.result.validationErrors, 'ar')
    expect(ar[0]).toMatch(/تواريخ/)
    const en = localizeValidationErrors(outcome.result.validationErrors, 'en')
    expect(en[0]).toMatch(/date/i)
  })

  it('handles unauthorized API responses', async () => {
    const handle = createTripPlannerHttpHandler({
      serviceOptions: { clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0) },
      requireAuth: true,
    })
    const res = await handle(
      new Request('https://tp.local/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          request: mapTravelSessionToTripPlannerRequest(readySession(), {
            userId: 'user_ah_1',
            idempotencyKey: 'idem_unauth',
          }),
        }),
      }),
    )
    expect(res.status).toBe(401)
    expect(formatApiTransportError('auth_error', 'x', 'ar')).toMatch(/جلس/)
    expect(formatApiTransportError('auth_error', 'x', 'en')).toMatch(/session/i)
  })

  it('treats expired/missing session as auth_error messaging', () => {
    expect(formatApiTransportError('auth_error', 'Unauthorized', 'ar')).toContain('الدخول')
  })

  it('supports cancellation via AbortSignal', async () => {
    const client = createInProcessClient()
    const controller = new AbortController()
    controller.abort()
    const request = mapTravelSessionToTripPlannerRequest(readySession(), {
      userId: 'user_ah_1',
      idempotencyKey: 'idem_ah_cancel',
    })
    const outcome = await runTripPlannerFlow({
      client,
      request,
      signal: controller.signal,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.code).toBe('cancelled')
  })

  it('supports retry by re-invoking the flow with a new idempotency key', async () => {
    const client = createInProcessClient()
    const session = readySession()
    const first = await runTripPlannerFlow({
      client,
      request: mapTravelSessionToTripPlannerRequest(session, {
        userId: 'user_ah_1',
        idempotencyKey: 'idem_retry_1',
        requestId: 'req_retry_1',
      }),
    })
    expect(first.ok).toBe(true)
    const second = await runTripPlannerFlow({
      client,
      request: mapTravelSessionToTripPlannerRequest(session, {
        userId: 'user_ah_1',
        idempotencyKey: 'idem_retry_2',
        requestId: 'req_retry_2',
      }),
    })
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.result.requestId).not.toBe(first.result.requestId)
  })

  it('polls until async completion when plan transport is temporarily unavailable', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 16, 0, 0),
    })
    const backing = createInProcessClient(service)
    let planCalls = 0
    const request = mapTravelSessionToTripPlannerRequest(readySession(), {
      userId: 'user_ah_1',
      idempotencyKey: 'idem_ah_poll',
      requestId: 'req_ah_poll',
    })

    // Seed a completed result via backing client, then simulate 503 on plan + poll getResult.
    await backing.plan(request)

    const client: TripPlannerApiClient = {
      health: backing.health.bind(backing),
      plan: async () => {
        planCalls += 1
        return {
          ok: false,
          status: 503,
          result: null,
          error: { code: 'handler_host_required', error: 'temporarily unavailable' },
        }
      },
      getResult: backing.getResult.bind(backing),
    }

    const stages: string[] = []
    const outcome = await runTripPlannerFlow({
      client,
      request,
      pollIntervalMs: 10,
      maxPollAttempts: 5,
      onStage: (s) => stages.push(String(s)),
    })
    expect(planCalls).toBe(1)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.status).toBe('completed')
    expect(outcome.polls).toBeGreaterThanOrEqual(1)
    expect(stages).toContain('Polling')
  })

  it('preserves recommendation reasons from backend adaptations', async () => {
    const client = createInProcessClient()
    const outcome = await runTripPlannerFlow({
      client,
      request: mapTravelSessionToTripPlannerRequest(readySession(), {
        userId: 'user_ah_1',
        idempotencyKey: 'idem_ah_reasons',
        requestId: 'req_ah_reasons',
      }),
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const adapted = adaptTripPlannerResultToSearchOrchestration(outcome.result)
    expect(adapted.rankedOptions[0]!.reasons.length).toBeGreaterThan(0)
    expect(outcome.result.confidence?.overall).toBeGreaterThan(0)
    expect(outcome.result.itinerary?.explanation.tradeOffs).toBeTruthy()
  })

  it('does not call mock live-search orchestrator path (API client only)', async () => {
    const spy = vi.fn()
    const client: TripPlannerApiClient = {
      health: async () => ({ ok: true, status: 200, body: {} }),
      plan: async (request) => {
        spy(request.userId)
        const real = createInProcessClient()
        return real.plan(request)
      },
      getResult: async () => ({ ok: false, status: 404, result: null, error: { code: 'not_found', error: 'x' } }),
    }
    await runTripPlannerFlow({
      client,
      request: mapTravelSessionToTripPlannerRequest(readySession(), {
        userId: 'user_ah_1',
        idempotencyKey: 'idem_ah_no_live',
      }),
    })
    expect(spy).toHaveBeenCalledWith('user_ah_1')
  })
})

// Keep unused import guard happy for Triptype references in docs of failures
void (null as unknown as TripPlannerResult)
