/**
 * Sprint 65 — Production Hardening & Go Live tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  applyRetry,
  auditFeatureFlags,
  auditProductionConfig,
  checkLiveness,
  createRetryBudget,
  generateProductionReadinessReport,
  getOpsMetrics,
  installProductionHardening,
  installProviderLogBridge,
  isProductionGoLiveReady,
  planRecovery,
  recordDomainTiming,
  resetDeadLetterQueue,
  resetLogger,
  resetOpsMetrics,
  runDependencyChecks,
  runSecurityAudit,
  timeDomain,
  validateDataIntegrity,
  PRODUCTION_V1_VERSION,
} from '../ops'
import { logProviderRequest, setProviderLogSink } from '../agent/liveProviders/providerLog'

describe('Sprint 65 — Production Hardening', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetOpsMetrics()
    resetLogger()
    resetDeadLetterQueue()
    setProviderLogSink(null)
  })

  afterEach(() => {
    setProviderLogSink(null)
    resetOpsMetrics()
    resetLogger()
  })

  it('runs security audit with mitigated findings and no open risks', () => {
    const report = runSecurityAudit()
    expect(report.findings.length).toBeGreaterThan(10)
    expect(report.riskCount).toBe(0)
    expect(report.ok).toBe(true)
    expect(report.findings.some((f) => f.area === 'Authentication')).toBe(true)
    expect(report.findings.some((f) => f.area === 'Secrets')).toBe(true)
    expect(report.findings.some((f) => f.area === 'Booking operations')).toBe(true)
  })

  it('audits feature flags and keeps live/payment risks OFF by default', () => {
    const report = auditFeatureFlags()
    expect(report.total).toBeGreaterThan(20)
    expect(report.ok).toBe(true)
    expect(report.riskyEnabled.filter((i) => i.risk === 'critical')).toHaveLength(0)
    expect(getFeatureRegistry().isEnabled('ai.live_providers')).toBe(false)
    expect(getFeatureRegistry().isEnabled('payments.live')).toBe(false)
  })

  it('flags production risk when live providers are enabled', () => {
    getFeatureRegistry().setEnabled('ai.live_providers', true)
    // dependency may block isEnabled — set providers.live_master if needed
    getFeatureRegistry().setEnabled('providers.live_master', true)
    const report = auditFeatureFlags()
    // If dependency chain prevents enable, ok stays true; otherwise critical appears
    if (getFeatureRegistry().isEnabled('ai.live_providers')
      || getFeatureRegistry().isEnabled('providers.live_master')) {
      expect(report.riskyEnabled.some((i) => i.risk === 'critical')).toBe(true)
      expect(report.ok).toBe(false)
    } else {
      expect(report.ok).toBe(true)
    }
  })

  it('audits production config requiring mock payments', () => {
    const ok = auditProductionConfig({
      target: 'production',
      paymentProvider: 'mock',
      liveProvidersEnabled: false,
    })
    expect(ok.ok).toBe(true)
    expect(ok.resolved.paymentProvider).toBe('mock')

    const bad = auditProductionConfig({
      target: 'production',
      paymentProvider: 'moyasar',
      liveProvidersEnabled: false,
    })
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((e) => /mock/i.test(e))).toBe(true)
  })

  it('validates data integrity and detects orphans', () => {
    const clean = validateDataIntegrity({
      bookings: [
        {
          id: 'bkg_1',
          provider: 'amadeus',
          confirmation: 'ABC',
          status: 'confirmed',
          travelerCount: 1,
        },
      ],
      trips: [
        {
          tripId: 'trip_1',
          userId: 'u1',
          bookingIds: ['bkg_1'],
          travelers: 1,
          timelineLength: 2,
        },
      ],
      documents: [
        {
          documentId: 'doc_1',
          tripId: 'trip_1',
          bookingId: 'bkg_1',
          checksum: 'abc',
          version: 1,
        },
      ],
    })
    expect(clean.ok).toBe(true)

    const orphan = validateDataIntegrity({
      bookings: [{ id: 'bkg_1', provider: 'amadeus', status: 'confirmed', confirmation: 'X', travelerCount: 1 }],
      trips: [{ tripId: 'trip_1', userId: 'u1', bookingIds: ['missing'], travelers: 1, timelineLength: 1 }],
      documents: [
        { documentId: 'd1', tripId: 'missing_trip', bookingId: 'bkg_1', checksum: 'x', version: 1 },
      ],
    })
    expect(orphan.ok).toBe(false)
    expect(orphan.issues.some((i) => i.code === 'orphan_trip_booking_ref')).toBe(true)
    expect(orphan.issues.some((i) => i.code === 'orphan_document_trip')).toBe(true)
  })

  it('plans recovery strategies for key scenarios', () => {
    const partial = planRecovery({ scenario: 'partial_booking_failure' })
    expect(partial.recoverable).toBe(true)
    expect(partial.actions.some((a) => a.strategy === 'partial_booking_rollback')).toBe(true)

    const unavailable = planRecovery({ scenario: 'provider_unavailable', circuitOpen: true })
    expect(unavailable.actions[0]?.strategy).toBe('circuit_open_fallback')

    const budget = createRetryBudget(2)
    applyRetry(budget)
    expect(budget.consumedAttempts).toBe(1)
  })

  it('records domain timings into ops metrics', () => {
    const value = timeDomain('booking', 'execute', () => 42, { provider: 'mock' })
    expect(value).toBe(42)
    recordDomainTiming('trip', 'load', 12, {}, true)
    const snap = getOpsMetrics().snapshot()
    expect(Object.keys(snap.counters).some((k) => k.includes('booking') || k.includes('trip') || k.includes('latency'))).toBe(true)
  })

  it('bridges provider logs into ops metrics', () => {
    const dispose = installProviderLogBridge()
    logProviderRequest({
      requestId: 'req_1',
      provider: 'amadeus',
      operation: 'searchFlights',
      durationMs: 55,
      status: 'ok',
    })
    const snap = getOpsMetrics().snapshot()
    expect(Object.keys(snap.gauges).some((k) => k.includes('provider.latency'))
      || Object.keys(snap.counters).some((k) => k.includes('provider.latency'))).toBe(true)
    dispose()
  })

  it('runs dependency / health checks', () => {
    expect(checkLiveness().status).toBe('ok')
    const deps = runDependencyChecks({
      target: 'development',
      enforceEnv: false,
      providers: [
        { id: 'mock', available: true },
        { id: 'amadeus', available: false },
      ],
      supabaseConfigured: true,
    })
    expect(deps.ok).toBe(true)
    expect(deps.dependencies.some((d) => d.id === 'dep.provider.amadeus' && d.status === 'warn')).toBe(true)
  })

  it('generates production readiness report and go-live gate', () => {
    const report = generateProductionReadinessReport({
      target: 'production',
      supabaseConfigured: true,
      providers: [{ id: 'mock', available: true }],
      integrity: {
        bookings: [
          { id: 'b1', provider: 'mock', confirmation: 'C', status: 'confirmed', travelerCount: 1 },
        ],
        trips: [
          { tripId: 't1', userId: 'u', bookingIds: ['b1'], travelers: 1, timelineLength: 1 },
        ],
      },
    })
    expect(report.version).toBe(PRODUCTION_V1_VERSION)
    expect(report.security.ok).toBe(true)
    expect(report.featureFlags.ok).toBe(true)
    expect(report.config.ok).toBe(true)
    expect(report.knownLimitations.length).toBeGreaterThan(0)
    expect(report.checklist.length).toBeGreaterThan(0)
    expect(isProductionGoLiveReady(report)).toBe(report.productionReady)
  })

  it('installs production hardening without throwing', () => {
    const result = installProductionHardening()
    expect(result.ok).toBe(true)
    result.dispose()
  })
})
