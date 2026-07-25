/**
 * RC2 — General Availability (GA) final release review.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  RC2_GA_EVIDENCE,
  RC2_GA_REVIEW_FEATURE_ID,
  RC2_GA_REVIEW_VERSION,
  RC2_MUST_STAY_OFF,
  createRc2GaReviewer,
  isRc2GaReviewEnabled,
  reviewFeatureFlags,
  validateMergeOrder,
} from '../rc2GaReview'

describe('RC2 — GA Review', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps rc2.ga_review OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(RC2_GA_REVIEW_FEATURE_ID)).toBe(false)
    expect(isRc2GaReviewEnabled()).toBe(false)
    expect(RC2_GA_REVIEW_VERSION).toMatch(/rc2-ga-review/)
  })

  it('reviewer is no-op when disabled', () => {
    expect(createRc2GaReviewer({ enabled: false }).run()).toBeNull()
  })

  it('critical flags default OFF', () => {
    const { rows, checks } = reviewFeatureFlags()
    for (const id of RC2_MUST_STAY_OFF) {
      const row = rows.find((r) => r.id === id)
      expect(row, id).toBeTruthy()
      expect(row!.defaultEnabled, id).toBe(false)
    }
    expect(checks.some((c) => c.id === 'flags_critical_off' && c.status === 'PASS')).toBe(true)
  })

  it('merge order is linear for production readiness stack', () => {
    const { stack, checks } = validateMergeOrder()
    expect(stack.map((s) => s.pr)).toEqual([277, 278, 279, 280, 281, 282, 0])
    expect(checks.some((c) => c.id === 'merge_stack_linear' && c.status === 'PASS')).toBe(true)
  })

  it('full review yields GO_WITH_CONDITIONS and no blockers', () => {
    const report = createRc2GaReviewer({ enabled: true }).run(RC2_GA_EVIDENCE)
    expect(report).not.toBeNull()
    expect(report!.goNoGo.decision).toBe('GO_WITH_CONDITIONS')
    expect(report!.goNoGo.blockers).toEqual([])
    expect(report!.goNoGo.conditions.length).toBeGreaterThan(0)
    expect(report!.readinessOverall).toBeGreaterThanOrEqual(95)
    expect(report!.checklist.every((c) => c.status !== 'BLOCKER')).toBe(true)
    expect(report!.documentationIndex.every((d) => d.exists)).toBe(true)
  })
})
