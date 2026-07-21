/**
 * Sprint 69 — Real Beta Operations & Production Monitoring tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  SPRINT69_OPERATIONS_VERSION,
  appendIncidentRecovery,
  buildEnvironmentReport,
  buildOpsIncidentReport,
  buildProductionOpsDashboard,
  buildProviderStatusReport,
  collectNotificationMonitorMetrics,
  collectOperationalAnalytics,
  collectPaymentMonitorMetrics,
  collectProviderMonitorMetrics,
  computeBetaOpsReadinessScore,
  createOpsIncident,
  decideGoNoGo,
  detectOpsEnvironment,
  generateAllOperationalReports,
  generateBetaOperationsReadinessReport,
  generateOperationalReport,
  installBetaOperationsMonitoring,
  resetDeadLetterQueue,
  resetIncidentManager,
  resetLogger,
  resetOpsMetrics,
  resolveOpsIncident,
  runBetaOperationsPreflight,
  runOperationsSmokeTests,
  switchOpsEnvironment,
  verifyOpsEnvironment,
} from '../ops'

describe('Sprint 69 — Real Beta Operations & Production Monitoring', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetOpsMetrics()
    resetLogger()
    resetIncidentManager()
    resetDeadLetterQueue()
  })

  afterEach(() => {
    resetOpsMetrics()
    resetLogger()
    resetIncidentManager()
    resetDeadLetterQueue()
  })

  it('manages beta environments with switch and verify', () => {
    expect(detectOpsEnvironment({ explicit: 'beta' })).toBe('beta')
    expect(detectOpsEnvironment({ env: { VITE_BETA_ENV: 'beta' } })).toBe('beta')
    const switched = switchOpsEnvironment('beta', { from: 'staging' })
    expect(switched.ok).toBe(true)
    expect(switched.to).toBe('beta')
    const report = buildEnvironmentReport('beta', {
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
      },
    })
    expect(report.ok).toBe(true)
    expect(verifyOpsEnvironment('development').environment).toBe('development')
  })

  it('monitors providers including Amadeus, Booking, Duffel', () => {
    const metrics = collectProviderMonitorMetrics('beta')
    const ids = metrics.map((m) => m.providerId)
    expect(ids).toContain('amadeus')
    expect(ids).toContain('booking')
    expect(ids).toContain('duffel')
    expect(ids).toContain('mock')
    const status = buildProviderStatusReport('beta')
    expect(['healthy', 'degraded', 'unhealthy']).toContain(status.overall)
  })

  it('monitors payments Stripe / HyperPay / Apple Pay / mock', () => {
    const payments = collectPaymentMonitorMetrics('beta')
    const ids = payments.map((p) => p.providerId)
    expect(ids).toContain('mock')
    expect(ids).toContain('stripe')
    expect(ids).toContain('hyperpay')
    expect(ids).toContain('apple_pay')
    expect(payments.find((p) => p.providerId === 'mock')?.refundPathReady).toBe(true)
  })

  it('monitors notification channels', () => {
    const notes = collectNotificationMonitorMetrics()
    const channels = notes.map((n) => n.channel)
    expect(channels).toEqual(expect.arrayContaining(['email', 'whatsapp', 'push', 'sms']))
    expect(notes.every((n) => n.queueHealth !== 'unhealthy')).toBe(true)
  })

  it('builds production ops dashboard panels', () => {
    const dash = buildProductionOpsDashboard('beta')
    expect(dash.conversation.id).toBe('conversation')
    expect(dash.search.id).toBe('search')
    expect(dash.recommendation.id).toBe('recommendation')
    expect(dash.booking.id).toBe('booking')
    expect(dash.trips.id).toBe('trips')
    expect(dash.documents.id).toBe('documents')
    expect(dash.payments.id).toBe('payments')
    expect(dash.providers.id).toBe('providers')
    expect(dash.notifications.id).toBe('notifications')
    expect(dash.system.id).toBe('system')
    expect(['healthy', 'degraded', 'unhealthy']).toContain(dash.overall)
  })

  it('generates operational reports', () => {
    const all = generateAllOperationalReports('beta')
    expect(all.map((r) => r.kind)).toEqual([
      'daily',
      'weekly',
      'provider',
      'booking',
      'conversation',
      'trip',
      'revenue',
      'system',
    ])
    expect(generateOperationalReport('revenue').summary).toContain('Mock')
  })

  it('supports incident lifecycle with recovery and postmortem', () => {
    const incident = createOpsIncident({
      title: 'Provider latency spike',
      severity: 'high',
      affectedServices: ['providers'],
      customerImpact: 'Search slower than budget',
    })
    expect(incident.status).toBe('detected')
    const recovering = appendIncidentRecovery(incident.id, 'Opened circuit + mock fallback')
    expect(recovering.timeline.length).toBeGreaterThan(1)
    const resolved = resolveOpsIncident(incident.id, 'Latency normalized; keep mock default')
    expect(['resolved', 'closed']).toContain(resolved.status)
    const report = buildOpsIncidentReport(incident.id)
    expect(report.postmortemTemplate).toContain('Postmortem')
    expect(report.recoveryLog.length).toBeGreaterThan(0)
  })

  it('runs operations smoke tests', async () => {
    const smoke = await runOperationsSmokeTests('beta', { skipE2E: true })
    expect(smoke.ok).toBe(true)
    const ids = smoke.checks.map((c) => c.id)
    expect(ids).toContain('conversation')
    expect(ids).toContain('payments')
    expect(ids).toContain('providers')
    expect(ids).toContain('notifications')
  })

  it('tracks operational analytics', () => {
    const analytics = collectOperationalAnalytics('beta')
    expect(analytics).toHaveProperty('searches')
    expect(analytics).toHaveProperty('bookings')
    expect(analytics).toHaveProperty('conversions')
    expect(analytics.topDestinations.length).toBeGreaterThan(0)
    expect(Object.keys(analytics.providerUsage).length).toBeGreaterThan(0)
  })

  it('produces beta readiness report with go/no-go', async () => {
    expect(SPRINT69_OPERATIONS_VERSION).toContain('ops')
    const score = computeBetaOpsReadinessScore({
      environmentOk: true,
      smokeOk: true,
      dashboardOk: true,
      providersOk: true,
      paymentsOk: true,
      notificationsOk: true,
      betaReady: true,
      openIncidents: 0,
    })
    expect(score).toBe(100)
    expect(decideGoNoGo(100, 0)).toBe('go')

    const report = await generateBetaOperationsReadinessReport({
      environment: 'beta',
      skipE2E: true,
    })
    expect(report.readinessScore).toBeGreaterThanOrEqual(75)
    expect(['go', 'conditional_go', 'no_go']).toContain(report.decision)
    expect(report.recommendation.length).toBeGreaterThan(10)
    expect(report.dashboard.overall).toBeTruthy()

    const preflight = await runBetaOperationsPreflight({ skipE2E: true })
    expect(preflight.environment).toBe('beta')
    const installed = installBetaOperationsMonitoring()
    installed.dispose()
  })
})
