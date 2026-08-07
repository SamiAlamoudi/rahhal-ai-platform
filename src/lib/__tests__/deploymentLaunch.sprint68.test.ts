/**
 * Sprint 68 — Production Deployment & Launch Automation tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  RAHHAL_V1_RELEASE_VERSION,
  RAHHAL_V1_RC_VERSION,
  SPRINT68_DEPLOYMENT_VERSION,
  buildCICDPipelineReport,
  buildFeatureMatrix,
  buildGoLiveChecklist,
  buildPassingCICDReport,
  buildProductionHealthReport,
  buildRollbackPlan,
  collectProductionMetrics,
  computeReadinessScore,
  detectDeployProfile,
  evaluateProductionAlerts,
  generateDeploymentLaunchReport,
  generateReleaseArtifacts,
  getDeployProfile,
  installDeploymentAutomation,
  isProductionDeploymentReady,
  resetLogger,
  resetOpsMetrics,
  runDeploymentValidation,
  runProductionDeploymentPreflight,
  triggerRollback,
  validateProductionSecrets,
  DEPLOY_PROFILES,
} from '../ops'

describe('Sprint 68 — Production Deployment & Launch Automation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetOpsMetrics()
    resetLogger()
  })

  afterEach(() => {
    resetOpsMetrics()
    resetLogger()
  })

  it('exposes four deploy profiles including beta', () => {
    expect(Object.keys(DEPLOY_PROFILES)).toEqual([
      'development',
      'staging',
      'beta',
      'production',
    ])
    expect(getDeployProfile('production').requireMockPayments).toBe(true)
    expect(getDeployProfile('beta').allowLiveProviders).toBe(true)
    expect(detectDeployProfile({ explicit: 'staging' }).name).toBe('staging')
    expect(detectDeployProfile({ env: { VITE_LAUNCH_PHASE: 'beta' } }).name).toBe('beta')
  })

  it('validates secrets and rejects client-bundled provider secrets', () => {
    const ok = validateProductionSecrets({
      profile: 'production',
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_LIVE_PROVIDERS_ENABLED: 'false',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJub25lIn0.e30.',
      },
      edgeSecrets: {
        AMADEUS_CLIENT_ID: 'id',
        AMADEUS_CLIENT_SECRET: 'secret',
      },
    })
    expect(ok.ok).toBe(true)
    expect(ok.items.some((i) => i.id === 'edge.amadeus' && i.status === 'ok')).toBe(true)

    const bad = validateProductionSecrets({
      profile: 'production',
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_AMADEUS_CLIENT_SECRET: 'leaked',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJub25lIn0.e30.',
      },
    })
    expect(bad.ok).toBe(false)
    expect(bad.forbidden.length).toBeGreaterThan(0)
  })

  it('builds subsystem health covering conversation through cache', () => {
    const health = buildProductionHealthReport({
      profile: 'production',
      paymentProvider: 'mock',
      supabaseConfigured: true,
    })
    expect(health.liveness).toBe('ok')
    const ids = health.subsystems.map((s) => s.id)
    expect(ids).toContain('conversation')
    expect(ids).toContain('rahhal_brain')
    expect(ids).toContain('search')
    expect(ids).toContain('booking')
    expect(ids).toContain('trip')
    expect(ids).toContain('providers')
    expect(ids).toContain('documents')
    expect(ids).toContain('payments')
    expect(ids).toContain('notifications')
    expect(ids).toContain('database')
    expect(ids).toContain('cache')
  })

  it('collects production metrics and evaluates alerts', () => {
    const metrics = collectProductionMetrics()
    expect(metrics).toHaveProperty('conversationLatencyMs')
    expect(metrics).toHaveProperty('bookingLatencyMs')
    expect(metrics).toHaveProperty('errorRate')
    expect(metrics).toHaveProperty('memoryPressure')

    const alerts = evaluateProductionAlerts()
    expect(alerts.ok).toBe(true)
    expect(alerts.criticalCount).toBe(0)
  })

  it('builds rollback plan with safe mode and all rollback kinds', () => {
    const plan = buildRollbackPlan()
    expect(plan.steps.length).toBeGreaterThanOrEqual(6)
    expect(plan.steps.some((s) => s.kind === 'deployment')).toBe(true)
    expect(plan.steps.some((s) => s.kind === 'configuration')).toBe(true)
    expect(plan.steps.some((s) => s.kind === 'provider')).toBe(true)
    expect(plan.steps.some((s) => s.kind === 'feature')).toBe(true)
    expect(plan.steps.some((s) => s.kind === 'safe_mode')).toBe(true)
    const forced = triggerRollback()
    expect(forced.safeMode).toBe(true)
  })

  it('reports CI/CD gates including rollback trigger', () => {
    const report = buildPassingCICDReport()
    expect(report.ok).toBe(true)
    expect(report.gates.map((g) => g.id)).toContain('smoke_verification')
    expect(report.gates.map((g) => g.id)).toContain('rollback_trigger')

    const failed = buildCICDPipelineReport({ lint: false, test: true, build: true })
    expect(failed.ok).toBe(false)
  })

  it('generates release artifacts for v1.0.0', () => {
    expect(RAHHAL_V1_RELEASE_VERSION).toBe('1.0.0')
    expect(RAHHAL_V1_RC_VERSION).toBe('1.0.0-rc')
    expect(SPRINT68_DEPLOYMENT_VERSION).toContain('deploy')
    const artifacts = generateReleaseArtifacts({ profile: 'production' })
    expect(artifacts.version).toBe('1.0.0')
    expect(artifacts.releaseNotes).toContain('Bilamo V1')
    expect(artifacts.rollbackGuide).toContain('safe mode')
    expect(artifacts.knownLimitations.length).toBeGreaterThan(3)
    expect(buildFeatureMatrix().length).toBeGreaterThan(10)
    expect(buildGoLiveChecklist().every((c) => c.status === 'done' || c.status === 'pending')).toBe(true)
  })

  it('runs deployment validation gates', async () => {
    const result = await runDeploymentValidation({
      profile: 'production',
      skipE2E: true,
      paymentProvider: 'mock',
    })
    expect(result.gates.some((g) => g.id === 'startup')).toBe(true)
    expect(result.gates.some((g) => g.id === 'payments')).toBe(true)
    expect(result.gates.some((g) => g.id === 'e2e_validation')).toBe(true)
  })

  it('generates launch report with readiness score and go-live status', async () => {
    const report = await generateDeploymentLaunchReport({
      profile: 'production',
      skipE2E: true,
      supabaseConfigured: true,
    })
    expect(report.version).toBe('1.0.0')
    expect(report.readinessScore).toBeGreaterThanOrEqual(80)
    expect(report.productionReady).toBe(true)
    expect(isProductionDeploymentReady(report)).toBe(true)
    expect(report.checklist.length).toBeGreaterThan(5)
    expect(report.summary).toContain('production ready')

    const score = computeReadinessScore({
      secretsOk: true,
      healthOk: true,
      alertsOk: true,
      validationOk: true,
      cicdOk: true,
      rollbackArmed: true,
    })
    expect(score).toBe(100)
  })

  it('preflight and install hooks are additive', async () => {
    const preflight = await runProductionDeploymentPreflight({ skipE2E: true })
    expect(preflight.ok).toBe(true)
    const installed = installDeploymentAutomation()
    expect(typeof installed.dispose).toBe('function')
    installed.dispose()
  })
})
