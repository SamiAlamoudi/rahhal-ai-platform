/**
 * Sprint 18 — RC1 Release Candidate Validation tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  RC1_MUST_STAY_OFF,
  RC1_SPRINT18_EVIDENCE,
  RC1_VALIDATION_FEATURE_ID,
  RC1_VALIDATION_VERSION,
  createRc1Validator,
  isRc1ValidationEnabled,
} from '../rc1Validation'

describe('Sprint 18 — RC1 Release Candidate Validation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps rc1.validation OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(RC1_VALIDATION_FEATURE_ID)).toBe(false)
    expect(isRc1ValidationEnabled()).toBe(false)
    expect(RC1_VALIDATION_VERSION).toMatch(/rc1-validation/)
  })

  it('keeps critical flags OFF by default', () => {
    for (const id of RC1_MUST_STAY_OFF) {
      expect(getFeatureRegistry().isEnabled(id), id).toBe(false)
    }
  })

  it('validator is no-op when disabled', async () => {
    const report = await createRc1Validator({ enabled: false }).run()
    expect(report).toBeNull()
  })

  it('runs full RC1 validation and produces GO decision', async () => {
    const report = await createRc1Validator({ enabled: true }).run(RC1_SPRINT18_EVIDENCE)
    expect(report).not.toBeNull()
    expect(report!.journeyHandoffs.length).toBeGreaterThanOrEqual(11)
    expect(report!.journeyHandoffs.every((h) => h.handedOff)).toBe(true)
    expect(report!.featureFlagMatrix.length).toBeGreaterThan(20)
    expect(report!.providers.some((p) => p.provider === 'payments' && p.fallbackOk)).toBe(true)
    expect(report!.checks.some((c) => c.area === 'recovery' && c.status === 'pass')).toBe(true)
    expect(report!.checks.some((c) => c.area === 'observability' && c.status === 'pass')).toBe(true)
    expect(report!.checks.some((c) => c.id === 'security_gate' && c.status === 'pass')).toBe(true)
    expect(report!.checks.some((c) => c.id === 'perf_chatpage_bundle' && c.status === 'pass')).toBe(true)
    expect(report!.goNoGo.blockers).toEqual([])
    expect(report!.goNoGo.decision).toBe('GO_WITH_CONDITIONS')
    expect(report!.goNoGo.conditions.some((c) => c.includes('staging_soak'))).toBe(true)
  })

  it('NO_GO when a critical check fails', async () => {
    const report = await createRc1Validator({ enabled: true }).run({
      ...RC1_SPRINT18_EVIDENCE,
      securityGatePass: false,
    })
    expect(report!.goNoGo.decision).toBe('NO_GO')
    expect(report!.goNoGo.blockers.some((b) => b.includes('security_gate'))).toBe(true)
  })
})
