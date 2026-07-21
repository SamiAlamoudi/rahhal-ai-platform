/**
 * Sprint 70 — General Availability (GA) Release tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  RAHHAL_GA_VERSION,
  SPRINT70_GA_VERSION,
  buildGAChecklist,
  buildGAReadinessReport,
  buildGAScorecard,
  buildVersionManifest,
  checkGACompatibility,
  formatVersionManifest,
  generateGAReleaseArtifacts,
  generateGAReleaseNotes,
  installGAReleaseManager,
  isGAChecklistComplete,
  resetLogger,
  resetOpsMetrics,
  resetDeadLetterQueue,
  resetIncidentManager,
  runGAReleaseManager,
  runGAVerification,
  validateGAIntegrity,
} from '../ops'

describe('Sprint 70 — General Availability (GA) Release', () => {
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

  it('builds version manifest for Rahhal 1.0.0 GA', () => {
    expect(RAHHAL_GA_VERSION).toBe('1.0.0')
    expect(SPRINT70_GA_VERSION).toContain('ga')
    const manifest = buildVersionManifest({
      packageVersion: '1.1.0-rc.1',
      commit: 'abc123',
      buildNumber: '70',
    })
    expect(manifest.rahhalVersion).toBe('1.0.0')
    expect(manifest.packageVersion).toBe('1.1.0-rc.1')
    expect(manifest.releaseType).toBe('GA')
    expect(manifest.commit).toBe('abc123')
    expect(formatVersionManifest(manifest)).toContain('1.0.0')
  })

  it('validates compatibility and integrity', () => {
    const compat = checkGACompatibility({ packageVersion: '1.1.0-rc.1' })
    expect(compat.ok).toBe(true)
    expect(compat.missingModules).toHaveLength(0)
    const integrity = validateGAIntegrity()
    expect(integrity.ok).toBe(true)
  })

  it('runs complete GA verification across domains', () => {
    const result = runGAVerification({ skipHeavy: true })
    expect(result.ok).toBe(true)
    const ids = result.checks.map((c) => c.id)
    expect(ids).toContain('security.audit')
    expect(ids).toContain('feature_flags')
    expect(ids).toContain('domain.conversation')
    expect(ids).toContain('flights')
    expect(ids).toContain('hotels')
    expect(ids).toContain('payments')
    expect(ids).toContain('cicd')
    expect(ids).toContain('rollback')
    expect(ids).toContain('beta_modules')
    expect(ids).toContain('production_modules')
  })

  it('generates release artifacts', () => {
    const manifest = buildVersionManifest()
    const notes = generateGAReleaseNotes(manifest)
    expect(notes).toContain('General Availability')
    const artifacts = generateGAReleaseArtifacts({ manifest })
    expect(artifacts.changelogV1).toContain('CHANGELOG')
    expect(artifacts.versionDoc).toContain('1.0.0')
    expect(artifacts.gaChecklist).toContain('GA Checklist')
    expect(artifacts.systemStatus).toContain('SYSTEM STATUS')
    expect(artifacts.apiStatus).toContain('API STATUS')
    expect(artifacts.knownLimitations).toContain('KNOWN LIMITATIONS')
    expect(artifacts.roadmapPostV1).toContain('ROADMAP')
  })

  it('builds GA checklist and scorecard', () => {
    const checklist = buildGAChecklist()
    expect(checklist.length).toBeGreaterThan(15)
    expect(isGAChecklistComplete(checklist)).toBe(true)
    const scores = buildGAScorecard({
      verificationOk: true,
      productionReady: true,
      securityOk: true,
      integrityOk: true,
      compatibilityOk: true,
      providerOk: true,
      paymentOk: true,
      notificationOk: true,
      checklistComplete: true,
    })
    expect(scores.overall).toBeGreaterThanOrEqual(90)
    expect(scores.paymentReadiness).toBe(100)
  })

  it('produces GA readiness report and release manager result', () => {
    const report = buildGAReadinessReport({
      skipHeavy: true,
      packageVersion: '1.1.0-rc.1',
      commit: 'deadbeef',
    })
    expect(report.gaReady).toBe(true)
    expect(report.scores.overall).toBeGreaterThanOrEqual(85)
    expect(report.manifest.rahhalVersion).toBe('1.0.0')
    expect(report.recommendation).toContain('GA Ready')
    expect(report.artifacts.releaseNotes).toContain('1.0.0')

    const managed = runGAReleaseManager({ skipHeavy: true })
    expect(managed.gaReady).toBe(true)
    expect(managed.version).toBe('1.0.0')
    const installed = installGAReleaseManager()
    installed.dispose()
  })
})
