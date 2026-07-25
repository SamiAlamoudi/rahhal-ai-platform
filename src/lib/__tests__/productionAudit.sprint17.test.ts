/**
 * Sprint 17 — Production Readiness Audit tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  CRITICAL_OFF_FLAGS,
  PRODUCTION_AUDIT_PLATFORM_FEATURE_ID,
  PRODUCTION_AUDIT_VERSION,
  PRODUCTION_CHECKLIST_KEYS,
  SPRINT17_AUDIT_EVIDENCE,
  createProductionReadinessAuditor,
  isProductionAuditPlatformEnabled,
} from '../productionAudit'

describe('Sprint 17 — Production Readiness Audit', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps production_audit.platform OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(PRODUCTION_AUDIT_PLATFORM_FEATURE_ID)).toBe(false)
    expect(isProductionAuditPlatformEnabled()).toBe(false)
    expect(PRODUCTION_AUDIT_VERSION).toMatch(/production-readiness-audit/)
  })

  it('keeps critical experimental flags OFF by default', () => {
    const registry = getFeatureRegistry()
    for (const id of CRITICAL_OFF_FLAGS) {
      expect(registry.isEnabled(id), id).toBe(false)
    }
  })

  it('auditor is no-op when disabled', () => {
    const auditor = createProductionReadinessAuditor({ enabled: false })
    expect(auditor.run(SPRINT17_AUDIT_EVIDENCE)).toBeNull()
  })

  it('produces scorecard, checklist, and findings from Sprint 17 evidence', () => {
    const auditor = createProductionReadinessAuditor({ enabled: true })
    const report = auditor.run(SPRINT17_AUDIT_EVIDENCE)
    expect(report).not.toBeNull()
    expect(report!.findings.length).toBeGreaterThan(10)
    expect(report!.scorecard.dimensions.map((d) => d.dimension)).toEqual(expect.arrayContaining([
      'Architecture',
      'Performance',
      'Security',
      'AI Quality',
      'Maintainability',
      'Scalability',
      'Reliability',
      'Developer Experience',
      'Production Readiness',
    ]))
    expect(report!.scorecard.overall).toBeGreaterThanOrEqual(85)
    expect(report!.scorecard.productionReady).toBe(true)
    for (const key of PRODUCTION_CHECKLIST_KEYS) {
      expect(report!.checklist[key]).toBeTruthy()
    }
    expect(report!.findings.some((f) => f.id === 'security_dependency_audit' && f.status === 'warn')).toBe(true)
    expect(report!.findings.some((f) => f.id === 'performance_chatpage_bundle' && f.status === 'pass')).toBe(true)
    expect(report!.findings.some((f) => f.id === 'architecture_circular' && f.status === 'pass')).toBe(true)
  })

  it('fails critical flag finding when a protected flag is enabled', () => {
    getFeatureRegistry().setEnabled('ai.live_providers', true)
    const findings = createProductionReadinessAuditor({ enabled: true })
      .collectFindings(SPRINT17_AUDIT_EVIDENCE)
    expect(findings.some((f) => f.id === 'feature_flags_critical_off' && f.status === 'fail')).toBe(true)
  })

  it('flags ChatPage bundle regression', () => {
    const findings = createProductionReadinessAuditor({ enabled: true }).collectFindings({
      ...SPRINT17_AUDIT_EVIDENCE,
      chatPageBundleKb: 145,
    })
    expect(findings.some((f) => f.id === 'performance_chatpage_bundle' && f.status === 'fail')).toBe(true)
  })
})
