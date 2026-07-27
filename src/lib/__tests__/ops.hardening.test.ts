import { describe, it, expect, beforeEach } from 'vitest'
import {
  maskMetadata,
  assertNoSecretsInText,
  maskEmail,
  createCorrelationId,
  getCorrelationId,
  setCorrelationId,
  StructuredLogger,
  AppError,
  toAppError,
  validateEnvironment,
  assertValidEnvironment,
  checkLiveness,
  checkReadiness,
  checkHealth,
  checkDomainRateLimit,
  checkAuthBruteForce,
  escapeHtml,
  assertRequestSize,
  buildCorsPolicy,
  SECURITY_HEADERS,
  buildSecurityHeaders,
  getOpsMetrics,
  resetOpsMetrics,
  recordProviderOutcome,
  getIdempotencyStore,
  resetIdempotencyStore,
  createRetryBudget,
  canRetry,
  consumeRetry,
  createTimeoutBudget,
  isTimeoutBudgetExhausted,
  createStaleRequestController,
  getGracefulShutdown,
  resetGracefulShutdown,
  shouldGracefullyDegrade,
  getDeadLetterQueue,
  resetDeadLetterQueue,
  checkFlowConsistency,
  runStartup,
  resetLogger,
} from '../ops'
import { clearRateLimit } from '../security/securityUtils'
import {
  createCircuitBreaker,
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
} from '../agent/aggregation'

describe('Phase X secret masking + structured logs', () => {
  beforeEach(() => {
    resetLogger()
    resetOpsMetrics()
  })

  it('masks email/phone/tokens in metadata and blocks secret-looking text', () => {
    expect(maskEmail('ahmed@example.com')).toBe('a***@example.com')
    const masked = maskMetadata({
      email: 'sara@example.com',
      phone: '+966501234567',
      apiKey: 'super-secret',
      token: 'abc',
      card: '4111111111111111',
      providerId: 'amadeus',
    })
    expect(masked.email).toBe('s***@example.com')
    expect(masked.phone).toBe('***4567')
    expect(masked.apiKey).toBe('[redacted]')
    expect(masked.token).toBe('[redacted]')
    expect(masked.card).toBe('[redacted]')
    expect(masked.providerId).toBe('amadeus')
    expect(assertNoSecretsInText('hello world')).toBe(true)
    expect(assertNoSecretsInText('Authorization: Bearer abc.def.ghi')).toBe(false)
  })

  it('emits JSON logs with correlation id, domain, operation, duration, success', () => {
    const lines: string[] = []
    const logger = new StructuredLogger({ sink: (l) => lines.push(l), minLevel: 'debug' })
    const cid = createCorrelationId()
    setCorrelationId(cid)
    logger.log({
      level: 'info',
      domain: 'booking',
      operation: 'create_session',
      message: 'created',
      durationMs: 12,
      success: true,
      metadata: { email: 'a@b.com', password: 'nope' },
    })
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0])
    expect(parsed.correlationId).toBe(cid)
    expect(parsed.domain).toBe('booking')
    expect(parsed.operation).toBe('create_session')
    expect(parsed.durationMs).toBe(12)
    expect(parsed.success).toBe(true)
    expect(parsed.metadata.password).toBe('[redacted]')
    expect(parsed.metadata.email).toBe('a***@b.com')
    expect(getCorrelationId()).toBe(cid)
  })
})

describe('Phase X canonical errors', () => {
  it('maps provider/timeout errors and exposes user-safe messages', () => {
    const timeout = toAppError(new Error('provider_timeout'), { domain: 'maps', operation: 'geocode' })
    expect(timeout.code).toBe('timeout')
    expect(timeout.userMessage).not.toMatch(/token|secret/i)
    expect(timeout.domain).toBe('maps')

    const rate = toAppError(new Error('rate_limited 429'))
    expect(rate.code).toBe('rate_limited')
    expect(rate.retryable).toBe(true)

    const app = new AppError({
      code: 'validation_error',
      message: 'bad input',
      diagnostics: { token: 'xyz', field: 'destination' },
    })
    expect(app.diagnostics.token).toBe('[redacted]')
    expect(app.toJSON().userMessage).toBeTruthy()
  })
})

describe('Phase X environment validation + startup', () => {
  it('rejects forbidden client secrets and non-mock payments in staging', () => {
    const bad = validateEnvironment({
      target: 'staging',
      env: {
        VITE_PAYMENT_PROVIDER: 'moyasar',
        VITE_GOOGLE_MAPS_API_KEY: 'AIza-fake',
      },
    })
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((e) => e.includes('VITE_PAYMENT_PROVIDER'))).toBe(true)
    expect(bad.errors.some((e) => e.includes('VITE_GOOGLE_MAPS_API_KEY'))).toBe(true)

    expect(() => assertValidEnvironment({
      target: 'production',
      env: { VITE_PAYMENT_PROVIDER: 'moyasar' },
    })).toThrow(/Invalid environment/)
  })

  it('accepts staging with mock payment and no client secrets', () => {
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
    expect(ok.resolved.paymentProvider).toBe('mock')
  })

  it('startup succeeds in development without fail-fast', () => {
    const result = runStartup({
      target: 'development',
      failFast: false,
      installHandlers: false,
    })
    expect(result.ok).toBe(true)
    expect(result.correlationId).toBeTruthy()
    result.dispose()
  })

  it('startup failure on invalid configuration when failFast', () => {
    expect(() => assertValidEnvironment({
      target: 'staging',
      env: {
        VITE_PAYMENT_PROVIDER: 'moyasar',
        VITE_AMADEUS_CLIENT_SECRET: 'leaked',
      },
    })).toThrow(/Invalid environment configuration/)
  })

  it('safe default keeps live providers disabled', () => {
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
  })
})

describe('Phase X health / readiness / liveness', () => {
  it('liveness is always ok; readiness fails on unsafe payment', () => {
    expect(checkLiveness().status).toBe('ok')
    const ready = checkReadiness({
      target: 'staging',
      paymentProvider: 'moyasar',
      enforceEnv: true,
    })
    expect(ready.status).toBe('fail')
    expect(ready.checks.payment_provider_safe.ok).toBe(false)

    const healthy = checkHealth({
      target: 'development',
      paymentProvider: 'mock',
      liveProvidersEnabled: false,
      enforceEnv: false,
    })
    expect(healthy.checks.payment_provider_safe.ok).toBe(true)
    expect(healthy.probe).toBe('health')
  })
})

describe('Phase X rate limiting + security helpers', () => {
  beforeEach(() => {
    clearRateLimit('auth:brute:user@x.com')
    clearRateLimit('search:ip1')
  })

  it('rate limits domains and auth brute-force', () => {
    expect(checkDomainRateLimit('search', 'ip1', 2)).toBe(true)
    expect(checkDomainRateLimit('search', 'ip1', 2)).toBe(true)
    expect(checkDomainRateLimit('search', 'ip1', 2)).toBe(false)

    expect(checkAuthBruteForce('user@x.com', 2)).toBe(true)
    expect(checkAuthBruteForce('user@x.com', 2)).toBe(true)
    expect(checkAuthBruteForce('user@x.com', 2)).toBe(false)
  })

  it('escapes HTML, enforces request size, builds CORS + security headers', () => {
    expect(escapeHtml('<script>"x"</script>')).toContain('&lt;script&gt;')
    expect(() => assertRequestSize(10)).not.toThrow()
    expect(() => assertRequestSize(999999999)).toThrow(/request_too_large/)
    const cors = buildCorsPolicy({
      allowedOrigins: ['https://app.example'],
      requestOrigin: 'https://app.example',
    })
    expect(cors.allowOrigin).toBe('https://app.example')
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("default-src 'self'")
    expect(SECURITY_HEADERS['Content-Security-Policy']).toMatch(/script-src 'self'(?! )/ )
    // Production CSP must not allow Vite HMR schemes / inline scripts.
    expect(SECURITY_HEADERS['Content-Security-Policy']).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(SECURITY_HEADERS['Content-Security-Policy']).not.toMatch(/connect-src[^;]*\bws:/)
    // Voice input (Home mic / Chat Web Speech) needs same-origin microphone.
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('microphone=(self)')
    expect(SECURITY_HEADERS['Permissions-Policy']).toContain('autoplay=(self)')
    expect(SECURITY_HEADERS['Permissions-Policy']).not.toMatch(/microphone=\(\)/)
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("media-src 'self' blob: data:")

    const devHeaders = buildSecurityHeaders({ development: true })
    expect(devHeaders['Content-Security-Policy']).toContain("script-src 'self' 'unsafe-inline'")
    expect(devHeaders['Content-Security-Policy']).toMatch(/connect-src[^;]*\bws:/)
  })
})

describe('Phase X observability metrics + circuit breaker', () => {
  beforeEach(() => {
    resetOpsMetrics()
  })

  it('records provider latency, failures, fallback, circuit open', () => {
    recordProviderOutcome({
      providerId: 'amadeus',
      durationMs: 40,
      failed: true,
      fallback: true,
      circuitOpen: true,
    })
    const snap = getOpsMetrics().snapshot()
    expect(Object.keys(snap.counters).some((k) => k.includes('provider.failures'))).toBe(true)
    expect(Object.keys(snap.counters).some((k) => k.includes('provider.fallback'))).toBe(true)
    expect(Object.keys(snap.gauges).some((k) => k.includes('provider.circuit_open'))).toBe(true)

    const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 1000 })
    breaker.recordFailure('amadeus')
    expect(breaker.snapshot('amadeus').state).toBe('open')
    getOpsMetrics().gauge('provider.circuit_open', 1, { providerId: 'amadeus' })
  })
})

describe('Phase X reliability', () => {
  beforeEach(() => {
    resetIdempotencyStore()
    resetDeadLetterQueue()
    resetGracefulShutdown()
  })

  it('enforces idempotency replay', async () => {
    const store = getIdempotencyStore()
    let calls = 0
    const a = await store.runOnce('k1', async () => {
      calls += 1
      return { ok: true }
    })
    const b = await store.runOnce('k1', async () => {
      calls += 1
      return { ok: false }
    })
    expect(a.replayed).toBe(false)
    expect(b.replayed).toBe(true)
    expect(b.result).toEqual({ ok: true })
    expect(calls).toBe(1)
  })

  it('tracks retry/timeout budgets and cancels stale requests', async () => {
    const retry = createRetryBudget(2, 10_000)
    expect(canRetry(retry)).toBe(true)
    consumeRetry(retry)
    consumeRetry(retry)
    expect(canRetry(retry)).toBe(false)

    const timeout = createTimeoutBudget(1)
    await new Promise((r) => setTimeout(r, 5))
    expect(isTimeoutBudgetExhausted(timeout)).toBe(true)

    const ctrl = createStaleRequestController(50)
    expect(ctrl.signal.aborted).toBe(false)
    ctrl.cancel('stale')
    expect(ctrl.signal.aborted).toBe(true)
    ctrl.dispose()
  })

  it('graceful shutdown runs hooks once', async () => {
    const shutdown = getGracefulShutdown()
    let hits = 0
    shutdown.onShutdown(() => {
      hits += 1
    })
    await shutdown.shutdown()
    await shutdown.shutdown()
    expect(hits).toBe(1)
    expect(shouldGracefullyDegrade({ providerFailures: 9, circuitOpen: false, envInvalid: false })).toBe(true)
  })

  it('dead-letter queue supports inspect + requeue', () => {
    const dlq = getDeadLetterQueue()
    const item = dlq.push({
      domain: 'notification',
      operation: 'deliver',
      error: 'upstream',
      payload: { sessionId: 'n1' },
      attempts: 3,
    })
    expect(dlq.list('notification')).toHaveLength(1)
    expect(dlq.requeue(item.id)?.id).toBe(item.id)
    expect(dlq.list()).toHaveLength(0)
  })

  it('detects inconsistent booking/payment/ticket/notification flows', () => {
    const bad = checkFlowConsistency({
      ticketStatus: 'issued',
      paymentStatus: 'failed',
      orderStatus: 'failed',
    })
    expect(bad.ok).toBe(false)
    expect(bad.issues.some((i) => i.code === 'ticket_without_payment')).toBe(true)

    const ok = checkFlowConsistency({
      bookingSessionId: 'b1',
      bookingStatus: 'confirmed',
      orderId: 'o1',
      orderStatus: 'paid',
      paymentStatus: 'paid',
      ticketStatus: 'delivered',
      notificationSessionIds: ['n1'],
      notificationStatuses: ['delivered'],
    })
    expect(ok.ok).toBe(true)
  })
})
