/**
 * Phase Y RC1 — repeatable staging smoke suite (library + static probes).
 * Verifies app probes, env safety, mock payment, live providers OFF,
 * security headers presence, and a compressed core journey.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import healthJson from '../../../public/health.json'
import readyJson from '../../../public/ready.json'
import headersRaw from '../../../public/_headers?raw'
import envExample from '../../../.env.example?raw'
import envStagingExample from '../../../.env.staging.example?raw'
import envProductionExample from '../../../.env.production.example?raw'
import opsHealthSrc from '../../../supabase/functions/ops-health/index.ts?raw'
import {
  checkLiveness,
  checkReadiness,
  checkHealth,
  validateEnvironment,
  assertValidEnvironment,
  SECURITY_HEADERS,
  maskEmail,
  maskMetadata,
  assertNoSecretsInText,
  checkDomainRateLimit,
  runStartup,
  resetLogger,
  resetOpsMetrics,
} from '../ops'
import { clearRateLimit } from '../security/securityUtils'
import {
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
  createLiveIntegration,
  createAggregationEngine,
  createMockAmadeusAdapter,
  createMockBookingComAdapter,
} from '../agent/aggregation'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import {
  PaymentOrchestrator,
  createMockPaymentAdapter,
  resetPaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
} from '../payment'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
} from '../booking'
import {
  TicketOrchestrator,
  resetTicketOrchestrator,
} from '../ticketing'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
import type { ChatMessage } from '../chat/chatTypes'
import type { TravelerInfo } from '../payment/checkoutTypes'

function user(content: string): ChatMessage {
  return {
    id: 'u-smoke',
    conversationId: 'c-smoke',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

function assertNoForbiddenClientSecretAssignments(text: string): void {
  const assignments = text
    .split('\n')
    .filter((line: string) =>
      /^VITE_(AMADEUS_CLIENT_SECRET|GOOGLE_MAPS_API_KEY|OPENWEATHER_API_KEY|MOYASAR_SECRET)/.test(line.trim()))
    .filter((line: string) => !line.trim().startsWith('#'))
  expect(assignments).toEqual([])
}

describe('RC1 staging smoke suite', () => {
  beforeEach(() => {
    resetLogger()
    resetOpsMetrics()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    resetTicketOrchestrator()
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    clearRateLimit('search:smoke')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('static health and readiness assets load', () => {
    expect(healthJson.status).toBe('ok')
    expect(healthJson.probe).toBe('liveness')
    expect(readyJson.status).toBe('ok')
  })

  it('library liveness / readiness / health pass for staging mock payment', () => {
    expect(checkLiveness().status).toBe('ok')
    const ready = checkReadiness({
      target: 'staging',
      paymentProvider: 'mock',
      liveProvidersEnabled: false,
    })
    expect(ready.status).toBe('ok')
    expect(ready.checks.payment_provider_safe.ok).toBe(true)
    const health = checkHealth({
      target: 'staging',
      paymentProvider: 'mock',
      liveProvidersEnabled: false,
    })
    expect(health.status === 'ok' || health.status === 'degraded').toBe(true)
  })

  it('ops-health edge function source exposes probes and payment safety', () => {
    expect(opsHealthSrc).toMatch(/probe/)
    expect(opsHealthSrc).toMatch(/payment_provider_safe|VITE_PAYMENT_PROVIDER/)
    expect(opsHealthSrc).toMatch(/live|ready|health/)
  })

  it('mock payment remains the only enabled payment mode in templates and test env', () => {
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    for (const text of [envExample, envStagingExample, envProductionExample]) {
      expect(text).toMatch(/^VITE_PAYMENT_PROVIDER=mock$/m)
      expect(text).not.toMatch(/^VITE_PAYMENT_PROVIDER=moyasar$/m)
    }
  })

  it('live providers remain off unless explicitly enabled', () => {
    const flags = resolveProviderFeatureFlags({
      liveIntegrationEnabled: false,
      providers: {
        amadeus: true,
        booking_com: true,
        google_maps: true,
        openweather: true,
      },
    })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)
    expect(isLiveProviderFlagEnabled(flags, 'booking_com')).toBe(false)
    expect(isLiveProviderFlagEnabled(flags, 'google_maps')).toBe(false)
    expect(isLiveProviderFlagEnabled(flags, 'openweather')).toBe(false)

    for (const text of [envStagingExample, envProductionExample]) {
      expect(text).toMatch(/VITE_LIVE_PROVIDERS_ENABLED=false/)
    }
  })

  it('environment validation fails safely on leaked client secrets / live payment', () => {
    const bad = validateEnvironment({
      target: 'staging',
      env: {
        VITE_PAYMENT_PROVIDER: 'moyasar',
        VITE_MOYASAR_SECRET_KEY: 'sk_test',
        VITE_GOOGLE_MAPS_API_KEY: 'AIza',
      },
    })
    expect(bad.ok).toBe(false)
    expect(() => assertValidEnvironment({
      target: 'production',
      env: { VITE_PAYMENT_PROVIDER: 'moyasar' },
    })).toThrow()
  })

  it('security headers are defined for SPA and public/_headers', () => {
    expect(SECURITY_HEADERS['Content-Security-Policy']).toMatch(/default-src 'self'/)
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
    expect(headersRaw).toMatch(/Content-Security-Policy/)
    expect(headersRaw).toMatch(/X-Frame-Options:\s*DENY/)
  })

  it('PII masking and secret text guards work', () => {
    expect(maskEmail('sami@example.com')).toBe('s***@example.com')
    expect(maskMetadata({ token: 'abc', email: 'a@b.com' }).token).toBe('[redacted]')
    expect(assertNoSecretsInText('hello')).toBe(true)
    expect(assertNoSecretsInText('Authorization: Bearer abc.def')).toBe(false)
  })

  it('rate limits are active', () => {
    clearRateLimit('search:smoke')
    expect(checkDomainRateLimit('search', 'smoke', 2)).toBe(true)
    expect(checkDomainRateLimit('search', 'smoke', 2)).toBe(true)
    expect(checkDomainRateLimit('search', 'smoke', 2)).toBe(false)
  })

  it('no client bundle secrets patterns in tracked env templates', () => {
    for (const text of [envExample, envStagingExample, envProductionExample]) {
      assertNoForbiddenClientSecretAssignments(text)
    }
  })

  it('startup succeeds under staging-safe defaults', () => {
    const result = runStartup({
      target: 'development',
      failFast: false,
      installHandlers: false,
    })
    expect(result.ok).toBe(true)
    result.dispose()
  })

  it('core journey smoke: plan → mock book → pay → ticket', async () => {
    const agent = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const turn = await agent.planTurn({
      conversationId: 'c-smoke',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan).toBeTruthy()

    const live = createLiveIntegration({
      flags: {
        liveIntegrationEnabled: false,
        mockFallbackEnabled: true,
        providers: { amadeus: false, booking_com: false, google_maps: false, openweather: false },
      },
    })
    live.registry.register(createMockAmadeusAdapter())
    live.registry.register(createMockBookingComAdapter())
    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: { selectionLog: live.selectionLog, metrics: live.metrics },
    })
    const flights = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2 },
      selectionStrategy: 'priority_fallback',
    })
    expect(flights.items.length).toBeGreaterThan(0)

    const booking = getBookingOrchestrator()
    const session = booking.createBookingSession({
      userId: 'smoke-user',
      travelSessionId: 'smoke-travel',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus_mock',
      providerName: 'Mock Air',
      providerOfferId: 'F-SMOKE',
      title: 'RUH → HND',
      price: 1200,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {
        flightNumber: 'SM1',
        segments: [{
          airline: 'Mock',
          flightNumber: 'SM1',
          from: 'RUH',
          to: 'HND',
          departureAt: '2027-04-01T10:00:00.000Z',
          arrivalAt: '2027-04-01T23:00:00.000Z',
          cabin: 'economy',
          baggage: '23kg',
        }],
      },
    })

    const travelers: TravelerInfo[] = [{
      id: 't1',
      firstName: 'Smoke',
      lastName: 'Tester',
      dateOfBirth: null,
      passportNumber: 'P123',
      passportExpiry: null,
      nationality: 'SA',
      type: 'adult',
    }]

    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await payment.startFromBooking({
      bookingSession: booking.getBookingSession(session.id)!,
      returnUrl: 'https://staging.example/return',
      travelers,
      customerEmail: 'smoke@example.com',
      customerName: 'Smoke Tester',
    })
    expect(started.success).toBe(true)
    const paid = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(paid.success).toBe(true)

    const tickets = new TicketOrchestrator({ bookingOrchestrator: booking })
    const issued = await tickets.startAndIssue({
      bookingSession: booking.getBookingSession(session.id)!,
      order: paid.order!,
      paymentSession: paid.paymentSession!,
    })
    expect(issued.success).toBe(true)
  })
})
