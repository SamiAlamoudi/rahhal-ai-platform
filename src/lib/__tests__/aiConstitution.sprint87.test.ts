/**
 * Sprint 87 — Rahhal AI Constitution tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  ALTERNATIVE_CONFIDENCE_THRESHOLD,
  RAHHAL_PRINCIPLES,
  REQUIRED_RECOVERY_ATTEMPTS,
  SPRINT87_AI_CONSTITUTION_VERSION,
  buildCompliantRecommendationSkeleton,
  containsForbiddenFailureLanguage,
  destinationIsVariable,
  evaluateDecisionPolicy,
  evaluateRecommendationPolicy,
  explanationCompleteness,
  getPrinciple,
  inferMissionFromText,
  isExplanationComplete,
  isRejectionCue,
  mayDeclareNoResults,
  missingRecoveryAttempts,
  normalizeConfidence,
  onConstitutionEvent,
  preferredFailureFraming,
  requiresAlternatives,
  resetConstitutionEventListeners,
  validatePrinciples,
  type ConstitutionEvent,
  type RecoveryAttemptKind,
} from '../../core'

describe('Sprint 87 — Rahhal AI Constitution', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConstitutionEventListeners()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetConstitutionEventListeners()
  })

  it('registers ai.constitution enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.constitution')).toBe(true)
    expect(SPRINT87_AI_CONSTITUTION_VERSION).toMatch(/ai-constitution/)
  })

  it('defines all seven mandatory principles', () => {
    expect(RAHHAL_PRINCIPLES).toHaveLength(7)
    expect(RAHHAL_PRINCIPLES.every((p) => p.severity === 'mandatory')).toBe(true)
    expect(RAHHAL_PRINCIPLES.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('getPrinciple returns principle 1 never end with no results', () => {
    const p = getPrinciple('never_end_with_no_results')
    expect(p.title).toMatch(/No Results/i)
    expect(p.summary).toMatch(/nearby airports/i)
  })

  describe('Principle 1 — Never End With No Results', () => {
    it('lists all required recovery attempts', () => {
      expect(REQUIRED_RECOVERY_ATTEMPTS).toEqual(expect.arrayContaining([
        'nearby_airports',
        'flexible_dates',
        'different_durations',
        'hotel_alternatives',
        'airline_alternatives',
        'nearby_destinations',
        'package_optimization',
        'budget_redistribution',
        'explanation',
        'multiple_options',
      ]))
      expect(REQUIRED_RECOVERY_ATTEMPTS).toHaveLength(10)
    })

    it('flags incomplete recovery before failure', () => {
      const result = validatePrinciples({
        snapshot: {
          endedWithNoResults: true,
          recoveryAttempts: ['nearby_airports', 'flexible_dates'],
        },
      })
      expect(result.ok).toBe(false)
      expect(result.violations.some((v) => v.code === 'incomplete_recovery_before_failure')).toBe(true)
    })

    it('flags ending with no results even if all attempts listed', () => {
      const result = validatePrinciples({
        snapshot: {
          endedWithNoResults: true,
          recoveryAttempts: [...REQUIRED_RECOVERY_ATTEMPTS],
        },
      })
      expect(result.violations.some((v) => v.principleId === 'never_end_with_no_results')).toBe(true)
    })

    it('mayDeclareNoResults is always false when ended empty', () => {
      expect(mayDeclareNoResults({ endedWithNoResults: true })).toBe(false)
    })

    it('missingRecoveryAttempts returns gaps', () => {
      const missing = missingRecoveryAttempts(['explanation' as RecoveryAttemptKind])
      expect(missing).toContain('nearby_airports')
      expect(missing).not.toContain('explanation')
    })
  })

  describe('Principle 2 — Mission Before Destination', () => {
    it('infers romantic mission from wife-happy language', () => {
      expect(inferMissionFromText('I want to make my wife happy')).toBe('Romantic Experience')
    })

    it('treats destination as variable when mission present', () => {
      expect(destinationIsVariable('Romantic Experience')).toBe(true)
      expect(destinationIsVariable(null)).toBe(false)
    })

    it('violates when destination locked over active mission', () => {
      const result = validatePrinciples({
        snapshot: {
          mission: 'Romantic Experience',
          destinationLocked: true,
        },
      })
      expect(result.violations.some((v) => v.principleId === 'mission_before_destination')).toBe(true)
    })
  })

  describe('Principle 3 — Explain Every Recommendation', () => {
    it('requires why, benefits, tradeoffs, confidence', () => {
      const complete = explanationCompleteness({
        why: 'Best fit',
        benefits: ['Direct'],
        tradeoffs: ['Cost'],
        confidence: 0.9,
      })
      expect(isExplanationComplete({
        why: 'Best fit',
        benefits: ['Direct'],
        tradeoffs: ['Cost'],
        confidence: 0.9,
      })).toBe(true)
      expect(complete.why && complete.benefits && complete.tradeoffs && complete.confidence).toBe(true)
    })

    it('flags incomplete explanation when recommendation present', () => {
      const result = validatePrinciples({
        snapshot: {
          hasRecommendation: true,
          explanation: { why: 'Because', benefits: [], tradeoffs: [], confidence: null },
        },
      })
      expect(result.violations.some((v) => v.code === 'missing_benefits')).toBe(true)
      expect(result.violations.some((v) => v.code === 'missing_tradeoffs')).toBe(true)
      expect(result.violations.some((v) => v.code === 'missing_confidence')).toBe(true)
    })

    it('passes with compliant recommendation skeleton', () => {
      const snap = buildCompliantRecommendationSkeleton({
        why: 'Matches mission',
        benefits: ['Walkable hotel'],
        tradeoffs: ['Slightly longer flight'],
        confidence: 0.88,
        alternatives: [{ id: 'a' }, { id: 'b' }],
      })
      const result = validatePrinciples({ snapshot: snap })
      expect(result.ok).toBe(true)
    })
  })

  describe('Principle 4 — Offer Alternatives', () => {
    it('requires alternatives below confidence threshold', () => {
      expect(requiresAlternatives(0.4)).toBe(true)
      expect(requiresAlternatives(0.9)).toBe(false)
      expect(normalizeConfidence(80)).toBe(0.8)
      expect(ALTERNATIVE_CONFIDENCE_THRESHOLD).toBe(0.65)
    })

    it('violates when low confidence and fewer than 2 alternatives', () => {
      const result = validatePrinciples({
        snapshot: {
          hasRecommendation: true,
          confidence: 0.5,
          alternativeCount: 1,
          explanation: {
            why: 'x',
            benefits: ['y'],
            tradeoffs: ['z'],
            confidence: 0.5,
          },
        },
      })
      expect(result.violations.some((v) => v.principleId === 'offer_alternatives')).toBe(true)
    })

    it('passes when low confidence but multiple alternatives', () => {
      const result = validatePrinciples({
        snapshot: {
          hasRecommendation: true,
          confidence: 0.5,
          alternativeCount: 3,
          explanation: {
            why: 'x',
            benefits: ['y'],
            tradeoffs: ['z'],
            confidence: 0.5,
          },
        },
      })
      expect(result.violations.some((v) => v.principleId === 'offer_alternatives')).toBe(false)
    })
  })

  describe('Principle 5 — Never Make User Feel Wrong', () => {
    it('detects forbidden failure language', () => {
      expect(containsForbiddenFailureLanguage('That is impossible')).toBe(true)
      expect(containsForbiddenFailureLanguage('You are wrong')).toBe(true)
      expect(containsForbiddenFailureLanguage('We cannot do that')).toBe(true)
      expect(containsForbiddenFailureLanguage('Here is the closest option')).toBe(false)
    })

    it('preferredFailureFraming explains constraints + closest solution', () => {
      const text = preferredFailureFraming({
        constraints: ['budget SAR 3000', 'weekend only'],
        closestSolution: 'a nearby city with similar vibe',
      })
      expect(text).toMatch(/closest achievable/i)
      expect(text).toMatch(/budget/)
    })

    it('violates on forbidden reply text', () => {
      const result = validatePrinciples({
        snapshot: { replyText: 'Impossible to book this.' },
      })
      expect(result.violations.some((v) => v.code === 'forbidden_failure_language')).toBe(true)
    })
  })

  describe('Principle 6 — Recover Conversation', () => {
    it('detects rejection cues', () => {
      expect(isRejectionCue('No')).toBe(true)
      expect(isRejectionCue('Not this')).toBe(true)
      expect(isRejectionCue('I changed my mind')).toBe(true)
      expect(isRejectionCue('Looks good')).toBe(false)
    })

    it('violates when rejection restarts instead of recovering', () => {
      const result = validatePrinciples({
        snapshot: {
          userRejected: true,
          recoveredWithoutRestart: false,
        },
      })
      expect(result.violations.some((v) => v.principleId === 'recover_conversation')).toBe(true)
    })

    it('passes when rejection recovers without restart', () => {
      const result = validatePrinciples({
        snapshot: {
          userRejected: true,
          recoveredWithoutRestart: true,
        },
      })
      expect(result.violations.some((v) => v.principleId === 'recover_conversation')).toBe(false)
    })
  })

  describe('Principle 7 — Respect User Intent', () => {
    it('violates when system overrides explicit intent', () => {
      const result = validatePrinciples({
        snapshot: {
          userIntent: 'only direct flights',
          systemOverrodeUserIntent: true,
        },
      })
      expect(result.violations.some((v) => v.principleId === 'respect_user_intent')).toBe(true)
    })

    it('decision policy also flags intent override', () => {
      const violations = evaluateDecisionPolicy({
        userIntent: 'halal only',
        systemOverrodeUserIntent: true,
      })
      expect(violations.some((v) => v.code === 'decision_ignored_intent')).toBe(true)
    })

    it('passes when intent is respected', () => {
      const result = validatePrinciples({
        snapshot: {
          userIntent: 'luxury hotel',
          systemOverrodeUserIntent: false,
        },
      })
      expect(result.violations.some((v) => v.principleId === 'respect_user_intent')).toBe(false)
    })
  })

  describe('validator / observability', () => {
    it('emits validation lifecycle events', () => {
      const seen: ConstitutionEvent['name'][] = []
      onConstitutionEvent((e) => seen.push(e.name))
      validatePrinciples({
        snapshot: buildCompliantRecommendationSkeleton({
          why: 'a',
          benefits: ['b'],
          tradeoffs: ['c'],
          confidence: 0.9,
        }),
      })
      expect(seen).toContain('constitution.validation.started')
      expect(seen).toContain('constitution.validation.passed')
      expect(seen).toContain('constitution.principle.checked')
    })

    it('emits failure + violation events', () => {
      const seen: ConstitutionEvent['name'][] = []
      onConstitutionEvent((e) => seen.push(e.name))
      validatePrinciples({
        snapshot: { replyText: 'This is wrong' },
      })
      expect(seen).toContain('constitution.validation.failed')
      expect(seen).toContain('constitution.violation')
    })

    it('can scope validation to a subset of principles', () => {
      const result = validatePrinciples({
        snapshot: {
          endedWithNoResults: true,
          recoveryAttempts: [],
          replyText: 'Impossible',
        },
        principles: ['never_make_user_feel_wrong'],
      })
      expect(result.checkedPrinciples).toEqual(['never_make_user_feel_wrong'])
      expect(result.violations.every((v) => v.principleId === 'never_make_user_feel_wrong')).toBe(true)
    })

    it('recommendation policy aggregates mission + explanation + alternatives', () => {
      const violations = evaluateRecommendationPolicy({
        mission: 'Family Experience',
        destinationLocked: true,
        hasRecommendation: true,
        confidence: 0.4,
        alternativeCount: 0,
        explanation: { why: null, benefits: [], tradeoffs: [], confidence: null },
      })
      expect(violations.length).toBeGreaterThan(2)
    })
  })
})
