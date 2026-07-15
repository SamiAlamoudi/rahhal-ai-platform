/**
 * Phase Y RC1 — failure-path coverage pack.
 * Documents and exercises timeout, rate limit, circuit breaker, mock fallback,
 * booking/payment/ticket/notification failures, auth/session, voice permission,
 * and dead-letter handling.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createLiveIntegration,
  createAggregationEngine,
  createCircuitBreaker,
  createProviderRateLimiter,
  createProviderAdapter,
  createMockAmadeusAdapter,
  withRetry,
  DEFAULT_RETRY_POLICY,
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
} from '../agent/aggregation'
import type { ProviderFetchResult } from '../agent/aggregation'
import {
  getDeadLetterQueue,
  resetDeadLetterQueue,
  toAppError,
  checkAuthBruteForce,
  validateEnvironment,
  createTimeoutBudget,
  isTimeoutBudgetExhausted,
  getIdempotencyStore,
  resetIdempotencyStore,
} from '../ops'
import { clearRateLimit } from '../security/securityUtils'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import {
  TripManager,
  resetTripRepository,
  resetTravelerProfileStore,
  resetSavedTripsStore,
  resetFavoriteDestinationsStore,
  resetRecentSearchesStore,
  resetTripManager,
} from '../trips'
import {
  TicketOrchestrator,
  resetTicketOrchestrator,
  MockFlightTicketProvider,
  MockHotelVoucherProvider,
} from '../ticketing'
import {
  NotificationOrchestrator,
  resetNotificationOrchestrator,
  canTransitionNotificationSession,
  notifyPaymentFailed,
} from '../notifications'
import {
  PaymentOrchestrator,
  createMockPaymentAdapter,
  resetPaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
  CheckoutOrchestrator,
} from '../payment'
import { MockPaymentProvider } from '../payment/mockPaymentProvider'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
} from '../booking'
import {
  queryMicrophonePermission,
  requestMicrophoneAccess,
} from '../chat/voice/microphonePermission'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { isBenignChatError } from '../chat/chatLogger'
import { mapAuthErrorMessage } from '../auth/authValidation'
import type { ChatMessage } from '../chat/chatTypes'
import type { TravelerInfo } from '../payment/checkoutTypes'
import type { BookingSession } from '../booking/bookingTypes'

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

function failingAdapter(id: string, errorCode: ProviderFetchResult['errorCode'], error: string) {
  return createProviderAdapter({
    metadata: {
      id,
      displayName: 'Failing',
      domains: ['flights'],
      priority: 99,
      reliability: 0.1,
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
        providerId: id,
        status: errorCode === 'timeout' ? 'timeout' : errorCode === 'rate_limited' ? 'rate_limited' : 'error',
        items: [],
        error,
        errorCode,
        durationMs: 5,
      }
    },
  })
}

async function startPaidableBooking(): Promise<{
  booking: ReturnType<typeof getBookingOrchestrator>
  bookingSession: BookingSession
}> {
  const booking = getBookingOrchestrator()
  const session = booking.createBookingSession({
    userId: 'user-1',
    travelSessionId: 'travel-fail',
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  })
  booking.addBookingItem(session.id, {
    type: 'flight',
    providerId: 'amadeus',
    providerName: 'Mock Air',
    providerOfferId: 'F1',
    title: 'Mock Air: RUH → HND',
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
    providerOfferId: 'H1',
    title: 'Tokyo Inn',
    price: 800,
    currency: 'SAR',
    bookingUrl: 'https://example.com/h',
    expiresAt: null,
    travelerSummary: '1 adult',
    metadata: {
      hotelName: 'Tokyo Inn',
      address: 'Tokyo',
      area: 'Shinjuku',
      checkIn: '2027-04-01',
      checkOut: '2027-04-03',
      roomType: 'Twin',
      rooms: 1,
    },
  })
  return { booking, bookingSession: booking.getBookingSession(session.id)! }
}

describe('RC1 failure paths', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetDeadLetterQueue()
    resetIdempotencyStore()
    clearRateLimit('auth:brute:rc1@example.com')
    clearRateLimit('search:smoke')
    resetTripRepository()
    resetTravelerProfileStore()
    resetSavedTripsStore()
    resetFavoriteDestinationsStore()
    resetRecentSearchesStore()
    resetTripManager()
    resetTicketOrchestrator()
    resetNotificationOrchestrator()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('provider timeout maps to canonical AppError and aggregation timeout status', async () => {
    const appErr = toAppError(new Error('provider_timeout'), { domain: 'flights', operation: 'search' })
    expect(appErr.code).toBe('timeout')
    expect(appErr.retryable).toBe(true)

    const live = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: true,
        mockFallbackEnabled: false,
        providers: { amadeus: false, booking_com: false, google_maps: false, openweather: false },
      },
      extraAdapters: [failingAdapter('timeout_prov', 'timeout', 'upstream timeout')],
    })
    live.registry.register(failingAdapter('timeout_prov', 'timeout', 'upstream timeout'))
    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: { selectionLog: live.selectionLog, metrics: live.metrics },
    })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1 },
    })
    expect(result.providerResults.some((p) => p.status === 'timeout' || p.errorCode === 'timeout')).toBe(true)
  })

  it('provider rate limit blocks further calls and surfaces rate_limited', () => {
    const limiter = createProviderRateLimiter({ defaultPerMinute: 1 })
    expect(limiter.allow('amadeus').allowed).toBe(true)
    const blocked = limiter.allow('amadeus')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)

    const rate = toAppError(new Error('rate_limited 429'))
    expect(rate.code).toBe('rate_limited')
  })

  it('circuit breaker opens after consecutive failures', () => {
    let now = 1000
    const breaker = createCircuitBreaker({
      failureThreshold: 2,
      openMs: 100,
      halfOpenSuccesses: 1,
      clock: () => now,
    })
    breaker.recordFailure('amadeus')
    breaker.recordFailure('amadeus')
    expect(breaker.snapshot('amadeus').state).toBe('open')
    expect(breaker.allow('amadeus')).toBe(false)
    now += 150
    expect(breaker.allow('amadeus')).toBe(true)
    expect(breaker.snapshot('amadeus').state).toBe('half_open')
  })

  it('falls back to mock provider when live fails', async () => {
    const live = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: true,
        mockFallbackEnabled: true,
        providers: { amadeus: false, booking_com: false, google_maps: false, openweather: false },
      },
      extraAdapters: [failingAdapter('amadeus_live_fail', 'upstream_error', 'down')],
    })
    live.registry.register(failingAdapter('amadeus_live_fail', 'upstream_error', 'down'))
    live.registry.register(createMockAmadeusAdapter())
    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: { selectionLog: live.selectionLog, metrics: live.metrics },
    })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1 },
    })
    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('partial provider failure still returns remaining domain results', async () => {
    const flags = resolveProviderFeatureFlags({
      liveIntegrationEnabled: false,
      mockFallbackEnabled: true,
      providers: { amadeus: false, booking_com: false, google_maps: false, openweather: false },
    })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)

    const live = createLiveIntegration({ flags })
    live.registry.register(failingAdapter('flights_broken', 'upstream_error', 'partial'))
    live.registry.register(createMockAmadeusAdapter())
    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: { selectionLog: live.selectionLog, metrics: live.metrics },
    })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'Japan', travelers: 1 },
    })
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.providerResults.some((p) => p.status === 'error' || p.status === 'ok')).toBe(true)
  })

  it('invalid trip input stays in collecting without TripPlan', async () => {
    const agent = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const turn = await agent.planTurn({
      conversationId: 'c-invalid',
      messages: [{
        id: 'u1',
        conversationId: 'c-invalid',
        role: 'user',
        modality: 'text',
        content: 'I want to travel',
        audioUrl: null,
        imageUrl: null,
        attachments: [],
        status: 'complete',
        error: null,
        providerMeta: {},
        createdAt: '2026-07-15T00:00:00.000Z',
        updatedAt: '2026-07-15T00:00:00.000Z',
      } satisfies ChatMessage],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.memory.phase).toBe('collecting')
    expect(turn.memory.missingFields.length).toBeGreaterThan(0)
  })

  it('booking readiness fails for missing items / expired URL paths', () => {
    const booking = getBookingOrchestrator()
    const empty = booking.createBookingSession({
      userId: 'user-1',
      travelSessionId: 't1',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    const readiness = booking.validateBookingReadiness(empty.id)
    expect(readiness.ready).toBe(false)
  })

  it('payment failure and duplicate lock prevention', async () => {
    const orchestrator = new CheckoutOrchestrator(new MockPaymentProvider(), { persist: false })
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [{
        id: 'item-1',
        type: 'flight',
        providerId: 'amadeus-1',
        providerName: 'Amadeus',
        providerOfferId: 'offer-1',
        title: 'RUH → HND',
        price: 1000,
        currency: 'SAR',
        bookingUrl: 'https://example.com/book',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        travelerSummary: '1 adult',
        metadata: {},
      }],
      currency: 'SAR',
      travelers: travelers(),
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const fail = await orchestrator.executePayment(session.order.id, 'wrong-token', { tokenizedCard: true })
    expect(fail.success).toBe(false)

    const paid = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(paid.success).toBe(true)
    const dup = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(dup.success).toBe(false)
  })

  it('ticket partial issuance + retry path', async () => {
    const { booking, bookingSession } = await startPaidableBooking()
    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await payment.startFromBooking({
      bookingSession,
      returnUrl: 'https://app.example/return',
      travelers: travelers(),
      customerEmail: 'a@example.com',
      customerName: 'Ahmed',
    })
    const captured = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(captured.success).toBe(true)

    const hotelItemId = bookingSession.items.find((i) => i.type === 'hotel')!.id
    const tickets = new TicketOrchestrator({
      bookingOrchestrator: booking,
      flightProvider: new MockFlightTicketProvider(),
      hotelProvider: new MockHotelVoucherProvider(),
    })

    const first = await tickets.startAndIssue({
      bookingSession: booking.getBookingSession(bookingSession.id)!,
      order: captured.order!,
      paymentSession: captured.paymentSession!,
      forceFailByBookingItemId: { [hotelItemId]: true },
    })
    expect(first.partial).toBe(true)
    expect(first.session?.audit.some((a) => a.type === 'partial_issuance')).toBe(true)

    const retried = await tickets.retryFailed(first.session!.id)
    expect(retried.complete).toBe(true)
    expect(retried.session?.lines.every((l) => l.status === 'issued')).toBe(true)
  })

  it('notification retry transition and payment-failed notify', async () => {
    expect(canTransitionNotificationSession('failed', 'queued')).toBe(true)
    const notifications = new NotificationOrchestrator()
    const result = await notifyPaymentFailed(notifications, {
      recipient: {
        userId: 'user-1',
        displayName: 'Ahmed',
        email: 'a@example.com',
        locale: 'en',
      },
      paymentSessionId: 'pay_1',
      orderId: 'ord_1',
      orderNumber: 'ON-1',
      amount: '100',
      currency: 'SAR',
      channels: ['email'],
    })
    expect(result).toBeTruthy()
  })

  it('dead-letter handling push / list / requeue', () => {
    const dlq = getDeadLetterQueue()
    const item = dlq.push({
      domain: 'notifications',
      operation: 'deliver',
      error: 'smtp_timeout',
      payload: { sessionId: 'n1' },
      attempts: 3,
    })
    expect(dlq.list('notifications')).toHaveLength(1)
    const requeued = dlq.requeue(item.id)
    expect(requeued?.id).toBe(item.id)
    expect(dlq.list('notifications')).toHaveLength(0)
  })

  it('unauthorized trip access is blocked', () => {
    const manager = new TripManager()
    const trip = manager.createTrip({
      userId: 'owner',
      title: 'Private',
      destination: 'Riyadh',
    })
    expect(manager.getTrip(trip.id, 'intruder')).toBeNull()
    expect(() => manager.cancelBooking(trip.id, 'intruder')).toThrow(/ownership/i)
  })

  it('expired session / auth error mapping and env fail-safe', () => {
    expect(mapAuthErrorMessage('Invalid login credentials')).toMatch(/غير صحيحة/)
    expect(mapAuthErrorMessage({ message: 'rate limit' })).toMatch(/محاولات|لاحقا/)

    expect(checkAuthBruteForce('rc1@example.com', 2)).toBe(true)
    expect(checkAuthBruteForce('rc1@example.com', 2)).toBe(true)
    expect(checkAuthBruteForce('rc1@example.com', 2)).toBe(false)

    const bad = validateEnvironment({
      target: 'production',
      env: {
        VITE_PAYMENT_PROVIDER: 'moyasar',
        VITE_LIVE_PROVIDERS_ENABLED: 'true',
        VITE_GOOGLE_MAPS_API_KEY: 'leaked',
      },
    })
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((e) => e.includes('VITE_GOOGLE_MAPS_API_KEY') || e.includes('VITE_PAYMENT_PROVIDER'))).toBe(true)
  })

  it('offline/reconnect budget + idempotency for duplicate payment events', async () => {
    const budget = createTimeoutBudget(1)
    await new Promise((r) => setTimeout(r, 5))
    expect(isTimeoutBudgetExhausted(budget)).toBe(true)

    const store = getIdempotencyStore()
    const first = await store.runOnce('pay_event_rc1', async () => ({ status: 'paid' }))
    const second = await store.runOnce('pay_event_rc1', async () => ({ status: 'duplicate' }))
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.result).toEqual({ status: 'paid' })
  })

  it('voice permission denied', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    })
    const denied = await requestMicrophoneAccess()
    expect(denied.state).toBe('denied')

    vi.stubGlobal('navigator', {})
    const unsupported = await queryMicrophonePermission()
    expect(unsupported.state).toBe('unsupported')
  })

  it('voice interruption and resume', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const errors: string[] = []
    const statuses: string[] = []
    const session = createVoiceSession({
      stt,
      tts,
      requestPermission: async () => ({ state: 'granted', error: null }),
      callbacks: {
        onError: (e) => errors.push(String(e)),
        onStatus: (s) => statuses.push(s),
      },
    })
    await session.startHandsFree('c1')
    expect(session.getStatus()).toBe('listening')
    session.interrupt(undefined, { resumeHandsFree: true })
    await new Promise((r) => setTimeout(r, 0))
    expect(session.getStatus()).toBe('listening')
    expect(statuses).toContain('reconnecting')
    expect(errors.filter((e) => !isBenignChatError(e))).toHaveLength(0)
    session.dispose()
  })

  it('retry budget for provider retries', async () => {
    let attempts = 0
    const { value, attempts: used } = await withRetry({
      policy: { ...DEFAULT_RETRY_POLICY, maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      shouldRetry: () => true,
      run: async () => {
        attempts += 1
        if (attempts < 3) throw new Error('transient')
        return 'ok'
      },
    })
    expect(value).toBe('ok')
    expect(used).toBe(3)
  })
})
