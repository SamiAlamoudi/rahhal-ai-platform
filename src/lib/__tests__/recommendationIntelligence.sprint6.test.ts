/**
 * Evolution Sprint 6 — Recommendation Intelligence Layer tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  RECOMMENDATION_INTELLIGENCE_FEATURE_ID,
  isRecommendationIntelligenceEnabled,
  runRecommendationEngine,
  tryRunRecommendationEngine,
  RecommendationEngine,
  reviseRecommendation,
  type RecommendationCandidate,
} from '../agent/recommendation'
import { createPlanningGraph, PlanningGraph } from '../agent/planningGraph'
import { createTravelerModel, observeTraveler } from '../agent/traveler'
import { createReflectionSession, reflectTurn } from '../agent/reflection'
import { runConsultantReasoningPipeline } from '../agent/reasoning'

function candidate(partial: RecommendationCandidate): RecommendationCandidate {
  return partial
}

describe('Evolution Sprint 6 — Recommendation Intelligence Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.recommendation_intelligence default OFF', () => {
      expect(getFeatureRegistry().isEnabled(RECOMMENDATION_INTELLIGENCE_FEATURE_ID)).toBe(false)
      expect(isRecommendationIntelligenceEnabled()).toBe(false)
      expect(
        tryRunRecommendationEngine({
          locale: 'en',
          candidates: [candidate({ id: 'a', label: 'A' })],
        }),
      ).toBeNull()
      expect(
        tryRunRecommendationEngine({
          locale: 'en',
          candidates: [candidate({ id: 'a', label: 'A', destinations: ['Dubai'], confidence: 0.8 })],
          enabled: true,
        }),
      ).not.toBeNull()
    })
  })

  describe('English — multiple plans', () => {
    it('recommends primary with why / why-not / impacts / formats', () => {
      const result = runRecommendationEngine({
        locale: 'en',
        candidates: [
          candidate({
            id: 'istanbul',
            label: 'Istanbul cultural week',
            destinations: ['Istanbul'],
            confidence: 0.82,
            score: 78,
            budget: { amount: 12000, currency: 'SAR', stance: 'value_seeking' },
            dates: { durationDays: 7 },
            travelerProfile: { purpose: 'cultural', pace: 'balanced', riskTolerance: 'medium' },
            evidence: ['user:named_istanbul'],
            risks: ['Peak crowds in historic core'],
            tradeoffs: ['City energy vs beach quiet'],
            missingData: [],
            whyExists: 'Traveler preferred Istanbul',
            reasoningRef: 'r1',
            reflectionRef: 'f1',
          }),
          candidate({
            id: 'baku',
            label: 'Baku cultural week',
            destinations: ['Baku'],
            confidence: 0.6,
            score: 55,
            budget: { amount: 9000, currency: 'SAR' },
            dates: { durationDays: 7 },
            travelerProfile: { purpose: 'cultural' },
            evidence: ['alt:baku'],
            whyExists: 'Lower cost alternative',
            missingData: ['hotel_style'],
          }),
        ],
        travelerHints: { preferValueOverCheapest: true, favorDestinations: ['Istanbul'] },
      })

      const pkg = result.package
      expect(pkg.primaryRecommendation.candidateId).toBe('istanbul')
      expect(pkg.whyThisOption.length).toBeGreaterThan(0)
      expect(pkg.whyNotAlternatives.length).toBeGreaterThan(0)
      expect(pkg.benefits.length).toBeGreaterThan(0)
      expect(pkg.risks.length).toBeGreaterThan(0)
      expect(pkg.tradeoffs.length).toBeGreaterThan(0)
      expect(pkg.opportunityCost.length).toBeGreaterThan(0)
      expect(pkg.budgetImpact.length).toBeGreaterThan(0)
      expect(pkg.comfortImpact.length).toBeGreaterThan(0)
      expect(pkg.timeImpact.length).toBeGreaterThan(0)
      expect(pkg.travelQualityImpact.length).toBeGreaterThan(0)
      expect(pkg.confidence).toBeGreaterThan(0.45)
      expect(pkg.evidence.length).toBeGreaterThan(0)
      expect(pkg.reasoningRef).toBe('r1')
      expect(result.formats.executive.headline).toBeTruthy()
      expect(result.formats.short.why).toBeTruthy()
      expect(result.formats.detailed.sections.length).toBeGreaterThan(5)
      expect(result.formats.consultant.justification.length).toBeGreaterThan(0)
      expect(result.compared.length).toBe(1)
      expect(pkg.action).toMatch(/recommend|compare/)
    })
  })

  describe('Arabic', () => {
    it('produces Arabic executive and consultant formats', () => {
      const result = runRecommendationEngine({
        locale: 'ar',
        candidates: [
          candidate({
            id: 'dubai',
            label: 'خطة دبي العائلية',
            destinations: ['Dubai'],
            confidence: 0.75,
            score: 70,
            budget: { amount: 15000, currency: 'SAR' },
            dates: { durationDays: 5 },
            travelerProfile: { purpose: 'family', riskTolerance: 'low' },
            evidence: ['user:دبي'],
            whyExists: 'تفضيل المسافر لدبي',
          }),
        ],
      })
      expect(result.package.locale).toBe('ar')
      expect(result.formats.executive.headline).toMatch(/توصية|اجمع|قارن|راجع/)
      expect(result.formats.consultant.voice[0]).toMatch(/مستشار/)
      expect(result.package.primaryRecommendation.summary).toMatch(/التوصية|الثقة|الخيارات/)
    })
  })

  describe('low confidence', () => {
    it('recommends collecting information when confidence is low', () => {
      const result = runRecommendationEngine({
        locale: 'en',
        candidates: [
          candidate({
            id: 'open',
            label: 'Open discovery',
            destinations: [],
            confidence: 0.25,
            score: 30,
            missingData: [
              'destination',
              'budget_amount',
              'duration',
              'trip_purpose',
              'party_size',
            ],
            evidence: [],
          }),
        ],
      })
      expect(result.package.action).toBe('collect_information')
      expect(result.package.questionsToImproveConfidence.length).toBeGreaterThan(0)
      expect(result.package.confidence).toBeLessThan(0.5)
      expect(result.formats.executive.action).toBe('collect_information')
    })
  })

  describe('conflicting constraints', () => {
    it('challenges assumptions on conflicting candidate data', () => {
      const result = runRecommendationEngine({
        locale: 'en',
        candidates: [
          candidate({
            id: 'conflict',
            label: 'Strict budget mystery',
            destinations: [],
            confidence: 0.55,
            score: 50,
            budget: { stance: 'strict', amount: null },
            constraints: { hard: ['destination:Paris'] },
            assumptions: ['Destination implied without traveler naming it'],
            missingData: ['budget_amount', 'destination'],
          }),
        ],
      })
      expect(result.package.assumptionsChallenged.length).toBeGreaterThan(0)
      expect(
        result.package.action === 'challenge_assumption'
          || result.package.action === 'collect_information'
          || result.package.assumptionsChallenged.length > 0,
      ).toBe(true)
    })
  })

  describe('revision', () => {
    it('links revision to previous package without inventing destinations', () => {
      const first = runRecommendationEngine({
        locale: 'en',
        candidates: [
          candidate({
            id: 'a',
            label: 'Open',
            confidence: 0.4,
            missingData: ['destination'],
          }),
        ],
      })
      const second = reviseRecommendation(first.package, {
        locale: 'en',
        candidates: [
          candidate({
            id: 'a2',
            label: 'Cairo week',
            destinations: ['Cairo'],
            confidence: 0.8,
            score: 72,
            budget: { amount: 8000, currency: 'SAR' },
            dates: { durationDays: 6 },
            missingData: [],
            evidence: ['user:cairo'],
          }),
        ],
        revisionReason: 'Traveler named Cairo',
      })
      expect(second.revisionOf).toBe(first.package.id)
      expect(second.revisionReason).toMatch(/Cairo/)
      expect(second.primaryRecommendation.candidateId).toBe('a2')
      // Never invent — only use provided destination
      expect(second.travelQualityImpact.some((t) => t.includes('Cairo'))).toBe(true)
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn; prior layers remain callable', async () => {
      const mod = await import('../agent/recommendation')
      expect('planTurn' in mod).toBe(false)
      expect(typeof mod.runRecommendationEngine).toBe('function')

      expect(
        runConsultantReasoningPipeline({ locale: 'en', userText: 'ideas' }).recommendation,
      ).toBeTruthy()

      const session = createReflectionSession('en')
      expect(
        reflectTurn(session, { userText: 'ideas', locale: 'en', enabled: true }).latestRecommendation,
      ).toBeTruthy()

      const graph = createPlanningGraph('en')
      const node = PlanningGraph.addRoot(graph, {
        locale: 'en',
        label: 'Plan A',
        destinations: ['Dubai'],
        confidence: 0.7,
        score: 65,
      })
      const fromGraph = RecommendationEngine.run({
        locale: 'en',
        candidates: [
          {
            id: node.id,
            label: node.label,
            destinations: node.destinations,
            confidence: node.confidence,
            score: node.score,
            budget: node.budget,
            dates: node.dates,
            evidence: node.evidence,
            missingData: node.missingData,
          },
        ],
      })
      expect(fromGraph.package.primaryRecommendation.candidateId).toBe(node.id)

      const tmodel = createTravelerModel('en')
      observeTraveler(tmodel, { userText: 'family trip', locale: 'en' })
      expect(tmodel.turnCount).toBe(1)
    })
  })
})
