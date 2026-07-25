/**
 * Sprint 19 — Staging Soak Test (Pre-GA).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  SOAK_SPRINT19_EVIDENCE,
  SOAK_STAGING_FEATURE_ID,
  SOAK_TESTING_VERSION,
  createSoakRunner,
  createStagingSoakOrchestrator,
  isSoakStagingEnabled,
  runFailureDurability,
} from '../soakTesting'

describe('Sprint 19 — Staging Soak Test (Pre-GA)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps soak.staging OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(SOAK_STAGING_FEATURE_ID)).toBe(false)
    expect(isSoakStagingEnabled()).toBe(false)
    expect(SOAK_TESTING_VERSION).toMatch(/staging-soak/)
  })

  it('runner is no-op when disabled', () => {
    expect(createSoakRunner({ enabled: false }).runProfile('sessions_500')).toBeNull()
  })

  it('completes 500 and 1000 session soaks', () => {
    const runner = createSoakRunner({ enabled: true })
    const s500 = runner.runProfile('sessions_500', { batchSize: 50 })
    const s1000 = runner.runProfile('sessions_1000', { batchSize: 50 })
    expect(s500!.sessions).toBe(500)
    expect(s1000!.sessions).toBe(1000)
    expect(s500!.errorRate).toBeLessThan(0.05)
    expect(s1000!.recoveryContinuityRate).toBeGreaterThanOrEqual(0.95)
    expect(s1000!.p99Ms).toBeLessThan(5_000)
  })

  it('concurrency profiles 50/100/250/500 stay stable', () => {
    const runner = createSoakRunner({ enabled: true })
    for (const id of ['concurrency_50', 'concurrency_100', 'concurrency_250', 'concurrency_500'] as const) {
      const m = runner.runProfile(id, { batchSize: 25 })
      expect(m!.sessions).toBeGreaterThanOrEqual(50)
      expect(m!.p95Ms).toBeLessThan(5_000)
    }
  })

  it('long conversations 50/100/150 turns remain continuous', () => {
    const runner = createSoakRunner({ enabled: true })
    for (const id of ['long_turns_50', 'long_turns_100', 'long_turns_150'] as const) {
      const m = runner.runProfile(id, { batchSize: 2 })
      expect(m!.recoveryContinuityRate).toBeGreaterThanOrEqual(0.95)
      expect(m!.errorRate).toBeLessThan(0.05)
    }
  })

  it('failure durability stays deterministic', () => {
    const a = runFailureDurability(80)
    const b = runFailureDurability(80)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(Math.abs(a.continuityRate - b.continuityRate)).toBeLessThan(0.2)
  })

  it('full orchestrator produces readiness ≥ 95 and no memory leak', () => {
    const report = createStagingSoakOrchestrator({ enabled: true }).run(SOAK_SPRINT19_EVIDENCE)
    expect(report).not.toBeNull()
    expect(report!.profiles.some((p) => p.id === 'sessions_500' && p.metrics.sessions === 500)).toBe(true)
    expect(report!.profiles.some((p) => p.id === 'sessions_1000' && p.metrics.sessions === 1000)).toBe(true)
    expect(report!.concurrency.map((c) => c.concurrentUsers).sort((a, b) => a - b)).toEqual([50, 100, 250, 500])
    expect(report!.memory.leaked).toBe(false)
    expect(report!.memory.cleanupsVerified.length).toBeGreaterThanOrEqual(5)
    expect(report!.longConversations.every((l) => l.ok)).toBe(true)
    expect(report!.failureDurability.ok).toBe(true)
    expect(report!.readiness.overall).toBeGreaterThanOrEqual(95)
    expect(report!.chatPageBundleKb).toBeLessThanOrEqual(139.29)
    expect(report!.blockers).toEqual([])
    expect(['GO', 'GO_WITH_CONDITIONS']).toContain(report!.decision)
  })
})
