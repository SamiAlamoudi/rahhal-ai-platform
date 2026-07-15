/**
 * Phase Y — RC1 staging smoke suite (repeatable, library-level).
 * Complements STAGING_SMOKE_TEST.md for CI/local gate checks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkHealth,
  checkLiveness,
  checkReadiness,
  validateEnvironment,
  assertNoSecretsInText,
  maskEmail,
  maskMetadata,
  SECURITY_HEADERS,
  checkDomainRateLimit,
} from '../ops'
import {
  createLiveIntegrationEngine,
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
} from '../agent/aggregation'
import {
  getDefaultPaymentProviderType,
  createMockPaymentAdapter,
  PaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
  resetPaymentOrchestrator,
} from '../payment'
import { getBookingOrchestrator, resetBookingOrchestrator } from '../booking'
import { authService } from '../auth/authService'
import { supabase } from '../supabaseClient'
import { clearRateLimit } from '../security/securityUtils'

describe('Phase Y RC1 staging smoke', () => {
  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    clearRateLimit('search:smoke-ip')
    vi.restoreAllMocks()
  })

  it('app module surface loads (auth + payment + booking + aggregation)', () => {
    expect(authService.signIn).toBeTypeOf('function')
    expect(getBookingOrchestrator).toBeTypeOf('function')
    expect(createMockPaymentAdapter().getCapabilities().mocked).toBe(true)
    const engine = createLiveIntegrationEngine({
      flags: {
        liveIntegrationEnabled: false,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
    })
    expect(engine.aggregate).toBeTypeOf('function')
  })

  it('auth works against mocked supabase session', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: {
        user: { id: 'smoke-user', email: 'smoke@example.com' },
        session: { access_token: 'tok' },
      },
      error: null,
    } as never)
    const result = await authService.signIn('smoke@example.com', 'Password123!')
    expect(result.success).toBe(true)
  })

  it('database access contract remains via supabase client env', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toMatch(/^https:\/\//)
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeTruthy()
    expect(supabase.auth).toBeTruthy()
  })

  it('health and readiness endpoints pass for staging-safe config', () => {
    expect(checkLiveness().status).toBe('ok')
    const ready = checkReadiness({
      target: 'staging',
      paymentProvider: 'mock',
      liveProvidersEnabled: false,
      enforceEnv: true,
    })
    expect(ready.status).toBe('ok')
    expect(ready.checks.payment_provider_safe.ok).toBe(true)

    const health = checkHealth({
      target: 'staging',
      paymentProvider: 'mock',
      liveProvidersEnabled: false,
      enforceEnv: true,
    })
    expect(health.checks.payment_provider_safe.ok).toBe(true)
    expect(['ok', 'degraded']).toContain(health.status)
  })

  it('mock payment remains active; live providers remain off by default', () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    const flags = resolveProviderFeatureFlags({
      liveIntegrationEnabled: false,
      providers: {
        amadeus: true,
        booking_com: true,
        google_maps: true,
        openweather: true,
      },
    })
    expect(flags.liveIntegrationEnabled).toBe(false)
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)
    expect(isLiveProviderFlagEnabled(flags, 'booking_com')).toBe(false)
  })

  it('environment validation fails safely for live payment / client secrets', () => {
    const bad = validateEnvironment({
      target: 'staging',
      env: {
        VITE_PAYMENT_PROVIDER: 'moyasar',
        VITE_GOOGLE_MAPS_API_KEY: 'AIza-fake',
      },
    })
    expect(bad.ok).toBe(false)

    const ok = validateEnvironment({
      target: 'staging',
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon',
      },
    })
    expect(ok.ok).toBe(true)
  })

  it('client env must not carry provider secrets; payment stays mock', () => {
    const secretKeys = [
      'VITE_AMADEUS_CLIENT_SECRET',
      'VITE_AMADEUS_CLIENT_ID',
      'VITE_OPENWEATHER_API_KEY',
      'VITE_GOOGLE_MAPS_API_KEY',
      'VITE_MOYASAR_SECRET_KEY',
    ]
    for (const key of secretKeys) {
      const value = (import.meta.env as Record<string, string | undefined>)[key]
      expect(value, key).toBeFalsy()
    }
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    expect(assertNoSecretsInText('safe operational log line')).toBe(true)
    expect(assertNoSecretsInText('Authorization: Bearer abc.def.ghi')).toBe(false)
    expect(assertNoSecretsInText('sk_live_ABCDEF123456')).toBe(false)
  })

  it('security headers, PII masking, and rate limits are active', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("default-src 'self'")
    expect(maskEmail('smoke@example.com')).toBe('s***@example.com')
    expect(maskMetadata({ token: 'abc', apiKey: 'k' }).token).toBe('[redacted]')
    expect(assertNoSecretsInText('Authorization: Bearer abc.def.ghi')).toBe(false)
    expect(checkDomainRateLimit('search', 'smoke-ip', 1)).toBe(true)
    expect(checkDomainRateLimit('search', 'smoke-ip', 1)).toBe(false)
  })

  it('core user journey slice: mock search + booking payment start', async () => {
    const engine = createLiveIntegrationEngine({
      flags: {
        liveIntegrationEnabled: false,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
    })
    const flights = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1, currency: 'SAR' },
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
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'SMOKE-F1',
      title: 'RUH → DXB',
      price: 900,
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
      returnUrl: 'https://staging.example/return',
      customerEmail: 'smoke@example.com',
      customerName: 'Smoke Tester',
    })
    expect(started.success).toBe(true)
    expect(payment.getAdapter().getCapabilities().mocked).toBe(true)
  })
})
