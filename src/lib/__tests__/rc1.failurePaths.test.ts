/**
 * Phase Y — RC1 failure-path coverage.
 * Documents and asserts resilience behaviors required for release candidate readiness.
 * Feature freeze: exercises existing public APIs only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLiveIntegration,
  createAggregationEngine,
  createProviderRegistry,
  createProviderAdapter,
  createCircuitBreaker,
  createProviderRateLimiter,
  createMockAmadeusAdapter,
  createMockGoogleMapsAdapter,
  withRetry,
  DEFAULT_RETRY_POLICY,
} from '../agent/aggregation'
import type { ProviderFetchResult } from '../agent/aggregation'
import { applyIntelligentDecisions } from '../agent/decision'
import { emptyRequirements } from '../agent/types'
import type { AgentToolResult } from '../agent/tools/types'
import { extractFromUserText } from '../agent/extractRequirements'
import { buildTripPlan } from '../agent/buildItinerary'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
} from '../booking'
import {
  PaymentOrchestrator,
  createMockPaymentAdapter,
  resetPaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
} from '../payment'
import {
  TicketOrchestrator,
  resetTicketOrchestrator,
} from '../ticketing'
import {
  NotificationOrchestrator,
  resetNotificationOrchestrator,
} from '../notifications'
import {
  TripManager,
  resetTripRepository,
  resetTravelerProfileStore,
  resetSavedTripsStore,
  resetFavoriteDestinationsStore,
  resetRecentSearchesStore,
  resetTripManager,
  getTripRepository,
} from '../trips'
import {
  getIdempotencyStore,
  resetIdempotencyStore,
  getDeadLetterQueue,
  resetDeadLetterQueue,
  toAppError,
} from '../ops'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { authService } from '../auth/authService'
import { supabase } from '../supabaseClient'
import type { TravelerInfo } from '../payment/checkoutTypes'
import type { ChatMessage } from '../chat/chatTypes'

function travelers(): TravelerInfo[] {
  return [{
    id: 't1',
    firstName: 'Ahmed',
    lastName: 'Al-Saud',
    dateOfBirth: null,
    passportNumber: 'A12345678',
    passportExpiry: null,
    nationality: 'SA',
    type: 'adult',
  }]
}

function failingLiveAdapter(liveId: string) {
  return createProviderAdapter({
    metadata: {
      id: liveId,
      displayName: 'Live failing',
      domains: ['flights'],
      priority: 95,
      reliability: 0.9,
      mocked: false,
    },
    isAvailable: () => true,
    capabilities: {
      features: ['live'],
      supportsSearch: true,
      supportsRealtime: true,
      rateLimitPerMinute: 60,
      mocked: false,
      futureSlot: false,
    },
    async fetch(): Promise<ProviderFetchResult> {
      return {
        providerId: liveId,
        status: 'error',
        items: [],
        error: 'upstream_down',
        errorCode: 'upstream_error',
        durationMs: 5,
      }
    },
  })
}

describe('Phase Y RC1 failure paths', () => {
  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    resetTicketOrchestrator()
    resetNotificationOrchestrator()
    resetTripRepository()
    resetTravelerProfileStore()
    resetSavedTripsStore()
    resetFavoriteDestinationsStore()
    resetRecentSearchesStore()
    resetTripManager()
    resetIdempotencyStore()
    resetDeadLetterQueue()
    vi.restoreAllMocks()
  })

  it('provider timeout surfaces timeout status and falls back', async () => {
    const slow = createProviderAdapter({
      metadata: {
        id: 'slow_maps',
        displayName: 'Slow',
        domains: ['maps'],
        priority: 90,
        reliability: 0.5,
        mocked: false,
      },
      isAvailable: () => true,
      capabilities: {
        features: ['geocode'],
        supportsSearch: true,
        supportsRealtime: true,
        rateLimitPerMinute: 10,
        mocked: false,
        futureSlot: false,
      },
      async fetch() {
        await new Promise((r) => setTimeout(r, 80))
        return {
          providerId: 'slow_maps',
          status: 'ok' as const,
          items: [],
          durationMs: 80,
        }
      },
    })
    const engine = createAggregationEngine({
      registry: createProviderRegistry([slow, createMockGoogleMapsAdapter()]),
      providerTimeoutMs: 15,
      selectionStrategy: 'priority_fallback',
    })
    const result = await engine.aggregate({
      domain: 'maps',
      locale: 'en',
      input: { destination: 'Riyadh' },
      selectionStrategy: 'priority_fallback',
    })
    expect(result.providerResults.some((p) => p.providerId === 'slow_maps' && p.status === 'timeout')).toBe(true)
    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(toAppError(new Error('provider_timeout')).code).toBe('timeout')
  })

  it('provider rate limit rejects further calls', () => {
    const limiter = createProviderRateLimiter({ defaultPerMinute: 2 })
    expect(limiter.allow('booking_com').allowed).toBe(true)
    expect(limiter.allow('booking_com').allowed).toBe(true)
    const third = limiter.allow('booking_com')
    expect(third.allowed).toBe(false)
    expect(third.retryAfterMs).toBeGreaterThan(0)
    expect(toAppError(new Error('rate_limited 429')).code).toBe('rate_limited')
  })

  it('circuit breaker open blocks provider calls', () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2, openMs: 60_000 })
    breaker.recordFailure('amadeus')
    breaker.recordFailure('amadeus')
    expect(breaker.snapshot('amadeus').state).toBe('open')
    expect(breaker.allow('amadeus')).toBe(false)
  })

  it('fallback to mock provider succeeds after live provider failure', async () => {
    const live = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: true,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
      extraAdapters: [failingLiveAdapter('amadeus_live_rc1')],
    })
    live.registry.register(failingLiveAdapter('amadeus_live_rc1'))
    live.registry.register(createMockAmadeusAdapter())

    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: {
        selectionLog: live.selectionLog,
        metrics: live.metrics,
      },
    })

    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1 },
    })

    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.items.length).toBeGreaterThan(0)
    expect(live.selectionLog.list().some((e) => e.event === 'selection.fallback')).toBe(true)
  })

  it('partial provider failure still allows decision scoring on remaining offers', () => {
    const requirements = {
      ...emptyRequirements(),
      destination: 'Tokyo',
      travelers: 2,
      budgetAmount: 8000,
      budgetCurrency: 'SAR',
    }
    const plan = buildTripPlan({
      conversationId: 'rc1-fail',
      locale: 'en',
      requirements,
    })
    const toolResults: AgentToolResult[] = [
      {
        tool: 'flights',
        status: 'ok',
        summary: 'flights',
        data: {
          offers: [
            { airline: 'Fast Air', from: 'RUH', to: 'HND', stops: 0, price: 2400, currency: 'SAR', durationHours: 11 },
          ],
        },
      },
      {
        tool: 'hotels',
        status: 'error',
        summary: 'hotels timeout',
        data: { offers: [] },
      },
    ]
    const decided = applyIntelligentDecisions(plan, toolResults, requirements)
    expect(decided.decision).toBeTruthy()
  })

  it('invalid trip input leaves intake incomplete', () => {
    const intake = extractFromUserText('asdf qwerty 123', 'en')
    expect(intake.patch.destination).toBeUndefined()
    expect(intake.patch.destinations).toBeUndefined()
    const plan = buildTripPlan({
      conversationId: 'rc1-invalid',
      locale: 'en',
      requirements: emptyRequirements(),
    })
    expect(plan.requirements.destination).toBeNull()
    expect(plan.title).toBeTruthy()
  })

  it('booking failure on currency mismatch', () => {
    const booking = getBookingOrchestrator()
    const session = booking.createBookingSession({
      userId: 'user-fail',
      travelSessionId: 'travel-fail',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    const result = booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'F-BAD',
      title: 'Bad currency flight',
      price: 100,
      currency: 'USD',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {},
    })
    expect(result.error).toBe('Currency mismatch')
  })

  it('payment failure with wrong lock token leaves order unpaid', async () => {
    const booking = getBookingOrchestrator()
    const session = booking.createBookingSession({
      userId: 'user-fail',
      travelSessionId: 'travel-pay-fail',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'F-PAY-FAIL',
      title: 'Mock Air',
      price: 500,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {},
    })
    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await payment.startFromBooking({
      bookingSession: booking.getBookingSession(session.id)!,
      returnUrl: 'https://app.example/checkout/return',
      travelers: travelers(),
      customerEmail: 'fail@example.com',
      customerName: 'Fail Path',
    })
    expect(started.success).toBe(true)
    const failed = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      'wrong-lock-token',
    )
    expect(failed.success).toBe(false)
    expect(failed.order?.status).not.toBe('paid')
  })

  it('duplicate payment event is idempotent / already-paid safe', async () => {
    const booking = getBookingOrchestrator()
    const session = booking.createBookingSession({
      userId: 'user-dup',
      travelSessionId: 'travel-dup',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'F-DUP',
      title: 'Mock Air',
      price: 700,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {},
    })
    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await payment.startFromBooking({
      bookingSession: booking.getBookingSession(session.id)!,
      returnUrl: 'https://app.example/checkout/return',
      travelers: travelers(),
      customerEmail: 'dup@example.com',
      customerName: 'Dup Path',
    })
    const first = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(first.success).toBe(true)

    const store = getIdempotencyStore()
    let calls = 0
    const a = await store.runOnce(`pay:${started.checkoutSession!.order.id}`, async () => {
      calls += 1
      return { paymentId: first.paymentSession?.id }
    })
    const b = await store.runOnce(`pay:${started.checkoutSession!.order.id}`, async () => {
      calls += 1
      return { paymentId: 'should-not-run' }
    })
    expect(a.replayed).toBe(false)
    expect(b.replayed).toBe(true)
    expect(calls).toBe(1)

    const retry = await payment.getCheckoutOrchestrator().retryPayment(started.checkoutSession!.order.id)
    expect(retry.success).toBe(false)
    expect(retry.message).toMatch(/already paid/i)
  })

  it('ticket partial issuance and retry recover failed items', async () => {
    const booking = getBookingOrchestrator()
    const session = booking.createBookingSession({
      userId: 'user-ticket',
      travelSessionId: 'travel-ticket',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'F-T1',
      title: 'Flight',
      price: 1000,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {
        flightNumber: 'MA1',
        segments: [{
          airline: 'Mock Air',
          flightNumber: 'MA1',
          from: 'RUH',
          to: 'HND',
          departureAt: '2027-04-01T10:00:00.000Z',
          arrivalAt: '2027-04-01T23:00:00.000Z',
          cabin: 'economy',
          baggage: '1 x 23kg',
        }],
      },
    })
    booking.addBookingItem(session.id, {
      type: 'hotel',
      providerId: 'booking_com',
      providerName: 'Booking.com',
      providerOfferId: 'H-T1',
      title: 'Hotel',
      price: 800,
      currency: 'SAR',
      bookingUrl: 'https://example.com/h',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {
        hotelName: 'Hotel',
        address: 'Tokyo',
        area: 'Shinjuku',
        checkIn: '2027-04-01',
        checkOut: '2027-04-05',
        roomType: 'Twin',
        rooms: 1,
      },
    })
    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await payment.startFromBooking({
      bookingSession: booking.getBookingSession(session.id)!,
      returnUrl: 'https://app.example/return',
      travelers: travelers(),
      customerEmail: 'ticket@example.com',
      customerName: 'Ticket Path',
    })
    const captured = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(captured.success).toBe(true)

    const tickets = new TicketOrchestrator({ bookingOrchestrator: booking })
    const hotelItemId = booking.getBookingSession(session.id)!.items.find((i) => i.type === 'hotel')!.id
    const first = await tickets.startAndIssue({
      bookingSession: booking.getBookingSession(session.id)!,
      order: captured.order!,
      paymentSession: captured.paymentSession!,
      forceFailByBookingItemId: { [hotelItemId]: true },
    })
    expect(first.partial).toBe(true)
    expect(first.session?.lines.some((l) => l.status === 'failed')).toBe(true)

    const retry = await tickets.retryFailed(first.session!.id)
    expect(retry.complete).toBe(true)
    expect(retry.session?.lines.every((l) => l.status === 'issued')).toBe(true)
  })

  it('notification retry and dead-letter handling', async () => {
    const notifications = new NotificationOrchestrator()
    const enqueued = notifications.enqueue({
      eventType: 'payment_failed',
      recipient: {
        userId: 'user-n',
        displayName: 'N',
        email: 'n@example.com',
        phoneE164: '+966501234567',
        locale: 'en',
      },
      channels: ['email'],
      forceFailChannels: ['email'],
      related: { paymentSessionId: 'pay-1', orderId: 'ord-1' },
      templateContext: { orderNumber: 'ORD-RC1' },
    })
    const failed = await notifications.deliver(enqueued.session!.id)
    expect(failed.success).toBe(false)
    expect(failed.session?.status).toBe('failed')

    const dlq = getDeadLetterQueue()
    dlq.push({
      domain: 'notification',
      operation: 'deliver',
      error: 'upstream',
      payload: { sessionId: enqueued.session!.id },
      attempts: failed.session?.attempts[0]?.attemptCount ?? 1,
    })
    expect(dlq.list('notification')).toHaveLength(1)

    const retried = await notifications.retry(enqueued.session!.id)
    expect(retried.success).toBe(true)
    expect(retried.session?.status).toBe('delivered')

    const requeued = dlq.requeue(dlq.list('notification')[0]!.id)
    expect(requeued?.domain).toBe('notification')
    expect(dlq.list('notification')).toHaveLength(0)
  })

  it('unauthorized trip access is denied', () => {
    const trips = new TripManager({ repository: getTripRepository() })
    const trip = trips.createTrip({
      userId: 'owner',
      title: 'Private Tokyo',
      destination: 'Tokyo',
      status: 'upcoming',
    })
    expect(trips.getTrip(trip.id, 'intruder')).toBeNull()
    expect(() => trips.cancelBooking(trip.id, 'intruder')).toThrow(/ownership/i)
    expect(() => trips.getTimeline(trip.id, 'intruder')).toThrow(/ownership/i)
    expect(trips.getTrip(trip.id, 'owner')?.id).toBe(trip.id)
  })

  it('expired session clears auth user', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    } as never)

    expect(await authService.getSession()).toBeNull()
    expect(await authService.getCurrentUser()).toBeNull()
  })

  it('offline interrupt returns mic to idle (not reconnecting/listening)', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const session = createVoiceSession({
      stt,
      tts,
      requestPermission: async () => ({ state: 'granted', error: null }),
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    await session.startHandsFree('rc1-offline')
    expect(session.getStatus()).toBe('listening')
    session.interrupt(undefined, { resumeHandsFree: true })
    await new Promise((r) => setTimeout(r, 0))
    expect(statuses).not.toContain('reconnecting')
    expect(session.getStatus()).toBe('idle')
    session.dispose()
  })

  it('voice permission denied blocks listening', async () => {
    const { provider: stt } = createMockSpeechToTextProvider()
    const tts = createMockTextToSpeechProvider()
    const session = createVoiceSession({
      stt,
      tts,
      locale: 'en',
      requestPermission: async () => ({ state: 'denied', error: 'blocked' }),
    })
    const permission = await session.ensureMicPermission()
    expect(permission.state).toBe('denied')
    expect(session.getStatus()).toBe('error')
    session.dispose()
  })

  it('voice interruption stops playback and allows resume', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('hello tokyo')
    const tts = createMockTextToSpeechProvider()
    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply: ChatMessage = {
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        modality: 'text',
        content: 'ok',
        audioUrl: null,
        imageUrl: null,
        attachments: [],
        status: 'complete',
        error: null,
        providerMeta: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'hello' },
        assistant: reply,
      }
    })
    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
    })
    await session.startPushToTalk()
    expect(session.getStatus()).toBe('listening')
    session.interrupt()
    expect(session.getStatus()).toBe('idle')
    await session.startPushToTalk()
    expect(session.getStatus()).toBe('listening')
    session.dispose()
  })

  it('retryable provider failures eventually succeed', async () => {
    let attempts = 0
    const { value, attempts: used } = await withRetry({
      policy: { ...DEFAULT_RETRY_POLICY, maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      shouldRetry: () => true,
      run: async (attempt) => {
        attempts = attempt
        if (attempt < 3) {
          throw Object.assign(new Error('transient'), { retryable: true })
        }
        return 'ok'
      },
    })
    expect(value).toBe('ok')
    expect(used).toBe(3)
    expect(attempts).toBe(3)
  })
})
