/**
 * Sprint 67 — Beta Launch Environment & Live Provider Activation tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  resetBookingDocumentCenter,
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingRecordStore,
  resetDefaultBookingSessionStore,
} from '../agent/bookingExecution'
import { resetDefaultBookingProviderRegistry } from '../agent/bookingIntelligence'
import { resetDefaultTripManagementService } from '../agent/tripManagement'
import { createPaymentProvider, resetPaymentProviderFactory } from '../payment/paymentProviderFactory'
import {
  auditBetaSecrets,
  buildBetaPaymentMatrix,
  buildBetaProviderMatrix,
  configureBetaLiveProviders,
  createBetaPaymentRegistry,
  createProductionNotificationLayer,
  enableBetaObservability,
  generateBetaReadinessReport,
  getBetaEnvironmentProfile,
  resetLogger,
  resetOpsMetrics,
  resolveBetaEnvironment,
  runBetaConfigDiagnostics,
  runBetaLaunchValidation,
  runBetaSecurityValidation,
  runBetaSmokeTests,
  BETA_LAUNCH_VERSION,
} from '../ops'
import { setProviderLogSink } from '../agent/liveProviders'

describe('Sprint 67 — Beta Launch', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
    resetDefaultBookingProviderRegistry()
    resetDefaultBookingRecordStore()
    resetBookingDocumentCenter()
    resetDefaultTripManagementService()
    resetPaymentProviderFactory()
    resetOpsMetrics()
    resetLogger()
    setProviderLogSink(null)
  })

  afterEach(() => {
    resetPaymentProviderFactory()
    setProviderLogSink(null)
  })

  it('resolves beta environment profiles', () => {
    expect(resolveBetaEnvironment('beta')).toBe('beta')
    const staging = getBetaEnvironmentProfile('staging')
    expect(staging.liveProvidersAllowed).toBe(true)
    expect(staging.mockPaymentsRequired).toBe(true)
    expect(staging.livePaymentsAllowed).toBe(false)
    const prod = getBetaEnvironmentProfile('production')
    expect(prod.mockPaymentsRequired).toBe(true)
  })

  it('builds live provider activation matrix (flag-controlled)', () => {
    const profile = getBetaEnvironmentProfile('beta')
    const matrix = buildBetaProviderMatrix(profile)
    expect(matrix.some((p) => p.providerId === 'mock' && p.mode === 'simulated')).toBe(true)
    expect(matrix.some((p) => p.providerId === 'amadeus')).toBe(true)
    expect(matrix.some((p) => p.providerId === 'booking')).toBe(true)
    expect(matrix.some((p) => p.providerId === 'duffel')).toBe(true)
    expect(matrix.some((p) => p.providerId === 'future')).toBe(true)
    // Default flags OFF → simulated
    expect(matrix.find((p) => p.providerId === 'amadeus')?.mode).toMatch(/simulated|unavailable/)
  })

  it('configures live provider flags when requested (skips without secrets)', () => {
    const result = configureBetaLiveProviders({
      enableMaster: true,
      providers: ['amadeus', 'booking', 'duffel'],
    })
    expect(result.enabled).toContain('ai.live_providers')
    expect(getFeatureRegistry().isEnabled('ai.live_providers')).toBe(true)
    // Without secrets, per-provider flags skipped
    expect(result.skipped.length).toBeGreaterThan(0)
  })

  it('wires payment abstraction with mock + stripe + hyperpay + apple_pay', () => {
    const profile = getBetaEnvironmentProfile('beta')
    const payments = buildBetaPaymentMatrix(profile)
    expect(payments.some((p) => p.gatewayId === 'mock' && p.available)).toBe(true)
    expect(payments.some((p) => p.gatewayId === 'stripe')).toBe(true)
    expect(payments.some((p) => p.gatewayId === 'hyperpay')).toBe(true)
    expect(payments.some((p) => p.gatewayId === 'apple_pay')).toBe(true)

    const registry = createBetaPaymentRegistry()
    expect(registry.list().length).toBeGreaterThanOrEqual(3)

    const stripe = createPaymentProvider('stripe')
    expect(stripe.providerId).toBe('stripe')
  })

  it('creates production notification layer with retry and delivery tracking', async () => {
    const layer = createProductionNotificationLayer({ maxRetries: 2 })
    expect(layer.slots.map((s) => s.channel).sort()).toEqual(
      ['email', 'push', 'sms', 'whatsapp'].sort(),
    )
    const result = await layer.send('email', {
      notificationSessionId: 'ns1',
      attemptId: 'a1',
      recipient: {
        userId: 'u1',
        displayName: 'Beta',
        email: 'beta@example.com',
        phoneE164: null,
        locale: 'en',
      },
      content: {
        subject: 'Hello',
        bodyText: 'Beta',
        bodyHtml: null,
        templateId: 'beta_test',
        variables: {},
      },
      seed: 's1',
    })
    expect(result.success).toBe(true)
    expect(layer.getDeliveryHistory('email').length).toBeGreaterThan(0)
    const push = await layer.send('push', {
      notificationSessionId: 'ns1',
      attemptId: 'a2',
      recipient: {
        userId: 'u1',
        displayName: 'Beta',
        email: 'beta@example.com',
        phoneE164: null,
        locale: 'en',
      },
      content: {
        subject: 'Push',
        bodyText: 'Hi',
        bodyHtml: null,
        templateId: 'beta_push',
        variables: {},
      },
      seed: 's2',
    })
    expect(push.success).toBe(true)
  })

  it('enables observability bridges', () => {
    const obs = enableBetaObservability()
    obs.recordSearchLatency(12, true)
    obs.recordBookingSuccess(true, 40)
    obs.recordProviderLatency('amadeus', 30, false)
    obs.recordTripLifecycle('created', 5)
    expect(obs.correlationId).toBeTruthy()
    obs.dispose()
  })

  it('runs configuration diagnostics and secrets audit', () => {
    const diag = runBetaConfigDiagnostics({ environment: 'development' })
    expect(diag.checks.length).toBeGreaterThan(0)
    const secrets = auditBetaSecrets()
    expect(secrets.exposedRisks).toEqual([])
  })

  it('runs beta security validation', () => {
    const sec = runBetaSecurityValidation()
    expect(sec.ok).toBe(true)
    expect(sec.checks.some((c) => c.id === 'sec.secrets_exposure')).toBe(true)
    expect(sec.checks.some((c) => c.id === 'sec.rate_limit')).toBe(true)
  })

  it('executes beta smoke tests (search/book/trip/docs/cancel/refresh)', async () => {
    const smoke = await runBetaSmokeTests()
    expect(smoke.ok).toBe(true)
    expect(smoke.flowsPassed).toBeGreaterThanOrEqual(5)
    expect(smoke.flowsFailed).toBe(0)
  })

  it('generates beta readiness report and full launch validation', async () => {
    const report = generateBetaReadinessReport({
      environment: 'development',
      smoke: { ok: true, flowsPassed: 5, flowsFailed: 0 },
    })
    expect(report.version).toBe(BETA_LAUNCH_VERSION)
    expect(report.betaReady).toBe(true)
    expect(report.providers.length).toBeGreaterThan(3)
    expect(report.payments.length).toBeGreaterThan(3)
    expect(report.notifications.length).toBe(4)

    const full = await runBetaLaunchValidation({
      environment: 'development',
      runSmoke: true,
    })
    expect(full.betaReady).toBe(true)
    expect(full.smoke?.ok).toBe(true)
  })
})
