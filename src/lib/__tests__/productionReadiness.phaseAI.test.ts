/**
 * Phase AI — Production Readiness v1 integration tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  resolveLiveCapabilityFlags,
  isLiveCapabilityEnabled,
  assertSafeLiveDefaults,
  loadAppConfig,
  resetAppConfig,
  runStartup,
  checkLiveness,
  checkReadiness,
  checkHealth,
  getOpsMetrics,
  resetOpsMetrics,
  recordRequestDuration,
  recordPlanningDuration,
  recordBookingDuration,
  recordFailure,
  recordRetry,
  recordCancellation,
  checkDomainRateLimit,
  createOpsCircuitBreaker,
  resetOpsCircuitBreaker,
  withConfiguredRetry,
  getRetryPolicy,
  classifyError,
  taxonomyCategoryForCode,
  AppError,
  StructuredLogger,
  resetLogger,
  setCorrelationId,
  createCorrelationId,
  runWithCorrelation,
  correlationIdFromHeaders,
  applyCorrelationToHeaders,
  RecordingTracerProvider,
  setTracerProvider,
  resetTracerProvider,
  withSpan,
  startSpan,
  sanitizeInput,
  rejectSensitivePayloadFields,
  buildCorsPolicy,
  SECURITY_HEADERS,
  assertRequestSize,
  syncFeatureRegistryFromCapabilities,
  requestGracefulShutdown,
  getGracefulShutdown,
  resetGracefulShutdown,
  validateEnvironment,
} from '../ops'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
} from '../ai/featureFlags'
import { resetSecurityRateLimits } from '../ops/security/securityPolicy'

describe('Phase AI — Production Readiness v1', () => {
  beforeEach(() => {
    resetAppConfig()
    resetFeatureRegistry()
    resetOpsMetrics()
    resetLogger()
    resetTracerProvider()
    resetOpsCircuitBreaker()
    resetGracefulShutdown()
    resetSecurityRateLimits()
  })

  describe('feature flags', () => {
    it('defaults all live capabilities OFF', () => {
      const flags = resolveLiveCapabilityFlags({})
      expect(flags.liveProvidersMaster).toBe(false)
      expect(flags.liveFlights).toBe(false)
      expect(flags.liveHotels).toBe(false)
      expect(flags.liveActivities).toBe(false)
      expect(flags.liveTransport).toBe(false)
      expect(flags.livePayments).toBe(false)
      expect(isLiveCapabilityEnabled(flags, 'live_flights')).toBe(false)
      expect(assertSafeLiveDefaults(flags).ok).toBe(true)
    })

    it('requires master switch for travel capabilities', () => {
      const withoutMaster = resolveLiveCapabilityFlags({
        VITE_LIVE_FLIGHTS_ENABLED: 'true',
        VITE_LIVE_HOTELS_ENABLED: 'true',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
      })
      expect(withoutMaster.liveFlights).toBe(false)
      expect(withoutMaster.liveHotels).toBe(false)

      const withMaster = resolveLiveCapabilityFlags({
        VITE_LIVE_PROVIDERS_ENABLED: 'true',
        VITE_LIVE_FLIGHTS_ENABLED: 'true',
        VITE_LIVE_HOTELS_ENABLED: 'true',
        VITE_LIVE_ACTIVITIES_ENABLED: 'true',
        VITE_LIVE_TRANSPORT_ENABLED: 'true',
      })
      expect(withMaster.liveFlights).toBe(true)
      expect(withMaster.liveHotels).toBe(true)
      expect(withMaster.liveActivities).toBe(true)
      expect(withMaster.liveTransport).toBe(true)
      // Payments still off unless explicitly enabled (and validation rejects enabling).
      expect(withMaster.livePayments).toBe(false)
    })

    it('syncs FeatureRegistry product flags from capabilities', () => {
      syncFeatureRegistryFromCapabilities({
        liveProvidersMaster: false,
        liveFlights: false,
        liveHotels: false,
        liveActivities: false,
        liveTransport: false,
        livePayments: true, // attempt — sync must force payments OFF
      })
      const registry = getFeatureRegistry()
      expect(registry.isEnabled('providers.live_master')).toBe(false)
      expect(registry.isEnabled('live.flights')).toBe(false)
      expect(registry.isEnabled('live.payments')).toBe(false)
      expect(registry.isEnabled('payments.live')).toBe(false)
      expect(registry.get('live.activities')?.enabled).toBe(false)
      expect(registry.get('live.transport')?.enabled).toBe(false)
    })
  })

  describe('startup validation', () => {
    it('loads config and passes startup with mock payment / live off', () => {
      const result = runStartup({
        target: 'staging',
        failFast: true,
        installHandlers: false,
        resetSingletons: true,
        env: {
          VITE_PAYMENT_PROVIDER: 'mock',
          VITE_LIVE_PROVIDERS_ENABLED: 'false',
          VITE_SUPABASE_URL: 'https://example.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'anon_test_key',
        },
      })
      expect(result.ok).toBe(true)
      expect(result.paymentProvider).toBe('mock')
      expect(result.liveCapabilities.liveFlights).toBe(false)
      expect(result.liveCapabilities.livePayments).toBe(false)
      result.dispose()
    })

    it('fails validation when live payments are enabled', () => {
      const env = validateEnvironment({
        target: 'staging',
        env: {
          VITE_PAYMENT_PROVIDER: 'mock',
          VITE_LIVE_PAYMENTS_ENABLED: 'true',
        },
      })
      expect(env.ok).toBe(false)
      expect(env.errors.some((e) => e.includes('live_payments'))).toBe(true)
    })

    it('rejects vite-prefixed provider secrets', () => {
      const env = validateEnvironment({
        target: 'production',
        env: {
          VITE_PAYMENT_PROVIDER: 'mock',
          VITE_AMADEUS_CLIENT_SECRET: 'leak',
        },
      })
      expect(env.ok).toBe(false)
      expect(env.errors.join(' ')).toMatch(/VITE_AMADEUS_CLIENT_SECRET/)
    })

    it('centralizes timeouts and rate limits in AppConfig', () => {
      const config = loadAppConfig({
        VITE_REQUEST_TIMEOUT_MS: '15000',
        VITE_PLANNING_TIMEOUT_MS: '25000',
      })
      expect(config.timeouts.requestMs).toBe(15000)
      expect(config.timeouts.planningMs).toBe(25000)
      expect(config.rateLimits.tripPlannerCreate).toBeGreaterThan(0)
      expect(config.retries.provider.maxAttempts).toBe(2)
    })
  })

  describe('health endpoints', () => {
    it('reports liveness / readiness / health with API DB queue cache checks', () => {
      resetAppConfig()
      loadAppConfig({
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
      })
      const live = checkLiveness()
      expect(live.status).toBe('ok')
      expect(live.checks.process.ok).toBe(true)

      const ready = checkReadiness({
        target: 'development',
        enforceEnv: false,
        config: loadAppConfig({ VITE_PAYMENT_PROVIDER: 'mock' }),
      })
      expect(ready.status).toBe('ok')
      expect(ready.checks.api?.ok).toBe(true)
      expect(ready.checks.database?.ok).toBe(true)
      expect(ready.checks.queue?.ok).toBe(true)
      expect(ready.checks.cache?.ok).toBe(true)
      expect(ready.checks.live_payments_off?.ok).toBe(true)

      const health = checkHealth({
        target: 'development',
        enforceEnv: false,
        config: loadAppConfig({ VITE_PAYMENT_PROVIDER: 'mock' }),
      })
      expect(['ok', 'degraded']).toContain(health.status)
      expect(health.checks.api?.ok).toBe(true)
    })
  })

  describe('metrics', () => {
    it('records request/planning/booking duration and failure/retry/cancel counters', () => {
      recordRequestDuration(12, { endpoint: 'plans' })
      recordPlanningDuration(40, { stage: 'Completed' })
      recordBookingDuration(55, { mode: 'preview' })
      recordFailure({ domain: 'planning' })
      recordRetry({ domain: 'provider' })
      recordCancellation({ domain: 'planning' })

      const snap = getOpsMetrics().snapshot()
      expect(
        Object.keys(snap.gauges).some((k) => k.includes('request.duration_ms')) ||
          Object.keys(snap.counters).some((k) => k.includes('request.duration_ms')),
      ).toBe(true)
      expect(Object.keys(snap.counters).some((k) => k.includes('ops.failures'))).toBe(true)
      expect(Object.keys(snap.counters).some((k) => k.includes('ops.retries'))).toBe(true)
      expect(Object.keys(snap.counters).some((k) => k.includes('ops.cancellations'))).toBe(true)
      expect(
        Object.keys(snap.gauges).some((k) => k.includes('planning.duration_ms')) ||
          Object.keys(snap.counters).some((k) => k.includes('planning.duration_ms')),
      ).toBe(true)
      expect(
        Object.keys(snap.gauges).some((k) => k.includes('booking.duration_ms')) ||
          Object.keys(snap.counters).some((k) => k.includes('booking.duration_ms')),
      ).toBe(true)
    })
  })

  describe('rate limiting', () => {
    it('enforces domain rate limits', () => {
      const key = 'phase_ai_rl'
      let limited = false
      for (let i = 0; i < 40; i += 1) {
        if (!checkDomainRateLimit('auth', key, 5)) {
          limited = true
          break
        }
      }
      expect(limited).toBe(true)
    })
  })

  describe('circuit breaker', () => {
    it('opens after failures and allows half-open recovery', () => {
      let now = 1_000
      const breaker = createOpsCircuitBreaker({
        failureThreshold: 2,
        openMs: 100,
        halfOpenSuccesses: 1,
        clock: () => now,
      })
      expect(breaker.allow('provider.flights')).toBe(true)
      breaker.recordFailure('provider.flights')
      expect(breaker.allow('provider.flights')).toBe(true)
      breaker.recordFailure('provider.flights')
      expect(breaker.allow('provider.flights')).toBe(false)
      expect(breaker.snapshot('provider.flights').state).toBe('open')

      now += 150
      expect(breaker.allow('provider.flights')).toBe(true)
      expect(breaker.snapshot('provider.flights').state).toBe('half_open')
      breaker.recordSuccess('provider.flights')
      expect(breaker.snapshot('provider.flights').state).toBe('closed')
    })
  })

  describe('retries', () => {
    it('retries retryable failures with configured policy', async () => {
      let attempts = 0
      const policy = getRetryPolicy('provider')
      const result = await withConfiguredRetry({
        policy: { ...policy, baseDelayMs: 1, maxDelayMs: 2 },
        run: async () => {
          attempts += 1
          if (attempts < 2) throw new Error('provider unavailable')
          return 'ok'
        },
        onRetry: () => recordRetry({ domain: 'provider' }),
      })
      expect(result.value).toBe('ok')
      expect(result.attempts).toBe(2)
      expect(attempts).toBe(2)
    })
  })

  describe('structured logging + correlation + tracing', () => {
    it('propagates correlation ids through services and logs', async () => {
      const lines: string[] = []
      resetLogger()
      const logger = new StructuredLogger({ sink: (l) => lines.push(l), minLevel: 'debug' })
      void logger

      // Use default logger after reset via getLogger by importing runWithCorrelation path.
      const cid = 'corr-phase-ai-001'
      setCorrelationId(cid)
      const headers: Record<string, string> = {}
      applyCorrelationToHeaders(headers, cid)
      expect(headers['x-correlation-id']).toBe(cid)
      expect(correlationIdFromHeaders(new Headers({ 'x-correlation-id': cid }))).toBe(cid)

      const recorder = new RecordingTracerProvider()
      setTracerProvider(recorder)

      const value = await runWithCorrelation({
        correlationId: cid,
        domain: 'planning',
        operation: 'plan',
        fn: async () => {
          const span = startSpan('inner')
          span.setAttribute('step', 1)
          span.end()
          return 42
        },
      })
      expect(value).toBe(42)
      expect(recorder.spans.length).toBeGreaterThan(0)
      expect(
        recorder.spans.some((s) => String(s.attributes['correlation.id']).includes('corr-phase-ai')),
      ).toBe(true)

      await withSpan('manual', async (span) => {
        span.addEvent('checkpoint')
      })
      expect(recorder.spans.some((s) => s.name === 'manual' && s.ended)).toBe(true)
    })

    it('emits structured JSON logs without secrets', () => {
      const lines: string[] = []
      const logger = new StructuredLogger({ sink: (l) => lines.push(l) })
      const cid = createCorrelationId()
      setCorrelationId(cid)
      logger.info('ops', 'metric', 'sample', {
        token: 'super-secret',
        email: 'a@b.com',
        endpoint: 'health',
      })
      expect(lines.length).toBe(1)
      const event = JSON.parse(lines[0]!)
      expect(event.correlationId).toBe(cid)
      expect(event.metadata.token).toBe('[redacted]')
      expect(String(event.metadata.email)).not.toContain('a@b.com')
    })
  })

  describe('error taxonomy', () => {
    it('maps errors into Validation/Auth/Authz/Provider/Timeout/Internal', () => {
      expect(taxonomyCategoryForCode('validation_error')).toBe('Validation')
      expect(taxonomyCategoryForCode('auth_error')).toBe('Authentication')
      expect(taxonomyCategoryForCode('forbidden')).toBe('Authorization')
      expect(taxonomyCategoryForCode('provider_error')).toBe('Provider')
      expect(taxonomyCategoryForCode('timeout')).toBe('Timeout')
      expect(taxonomyCategoryForCode('internal_error')).toBe('Internal')

      const timeout = classifyError(new Error('upstream timeout'))
      expect(timeout.category).toBe('Timeout')
      expect(timeout.retryable).toBe(true)

      const auth = classifyError(
        new AppError({ code: 'auth_error', message: 'no session' }),
      )
      expect(auth.category).toBe('Authentication')
      expect(auth.status).toBe(401)
    })
  })

  describe('security', () => {
    it('sanitizes inputs, rejects sensitive fields, validates CORS/headers/size', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
      expect(rejectSensitivePayloadFields({ destinations: ['X'] }).ok).toBe(true)
      expect(rejectSensitivePayloadFields({ cardNumber: '4111' }).ok).toBe(false)
      expect(rejectSensitivePayloadFields({ password: 'x' }).ok).toBe(false)

      const cors = buildCorsPolicy({
        allowedOrigins: ['https://app.rahhal.example'],
        requestOrigin: 'https://app.rahhal.example',
      })
      expect(cors.allowOrigin).toBe('https://app.rahhal.example')
      expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
      expect(() => assertRequestSize(10, 100)).not.toThrow()
      expect(() => assertRequestSize(200, 100)).toThrow()
    })
  })

  describe('graceful shutdown', () => {
    it('runs shutdown hooks', async () => {
      const shutdown = getGracefulShutdown()
      let called = false
      shutdown.onShutdown(() => {
        called = true
      })
      await requestGracefulShutdown()
      expect(called).toBe(true)
      expect(shutdown.isShuttingDown()).toBe(true)
    })
  })
})
