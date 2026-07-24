/**
 * Evolution Sprint 1 — Consultant Reasoning Layer tests
 * Unit + pipeline + Arabic/English examples + regression (no planTurn wiring).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { emptyRequirements } from '../agent/types'
import {
  analyzeTravelerIntent,
  buildTravelerProfile,
  analyzeConstraints,
  reasonAboutDestination,
  reasonAboutBudget,
  reasonAboutRisk,
  reasonAboutValue,
  reasonAboutRecommendation,
  generateExplanation,
  formatConsultantAnswers,
  runConsultantReasoningPipeline,
  tryRunConsultantReasoningPipeline,
  isConsultantReasoningEnabled,
  CONSULTANT_REASONING_FEATURE_ID,
  TravelerIntentAnalyzer,
  TravelerProfileBuilder,
  ConstraintAnalyzer,
  DestinationReasoner,
  BudgetReasoner,
  RiskReasoner,
  ValueReasoner,
  RecommendationReasoner,
  ExplanationGenerator,
  ReasoningPipeline,
  runTravelReasoning,
  isTravelReasoningEnabled,
  type ReasoningSlice,
} from '../agent/reasoning'

function assertSlice(slice: ReasoningSlice) {
  expect(slice.confidence).toBeGreaterThanOrEqual(0)
  expect(slice.confidence).toBeLessThanOrEqual(1)
  expect(slice.recommendationScore).toBeGreaterThanOrEqual(0)
  expect(slice.recommendationScore).toBeLessThanOrEqual(100)
  expect(Array.isArray(slice.reasoning)).toBe(true)
  expect(Array.isArray(slice.tradeoffs)).toBe(true)
  expect(Array.isArray(slice.assumptions)).toBe(true)
  expect(Array.isArray(slice.missingInformation)).toBe(true)
}

describe('Evolution Sprint 1 — Consultant Reasoning Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.consultant_reasoning default OFF', () => {
      const registry = getFeatureRegistry()
      expect(registry.isEnabled(CONSULTANT_REASONING_FEATURE_ID)).toBe(false)
      expect(isConsultantReasoningEnabled()).toBe(false)
    })

    it('tryRun returns null when flag off; runs when forced', () => {
      expect(tryRunConsultantReasoningPipeline({ userText: 'trip ideas' })).toBeNull()
      const forced = tryRunConsultantReasoningPipeline(
        { userText: 'trip ideas', locale: 'en' },
        { enabled: true },
      )
      expect(forced).not.toBeNull()
      expect(forced?.recommendation.recommendation.primaryAction).toBeTruthy()
    })
  })

  describe('unit modules — shared slice contract', () => {
    const input = {
      locale: 'en' as const,
      userText: 'Family vacation ideas, safe and relaxed, budget around 12000 SAR for 7 days',
      known: {
        budgetAmount: 12000,
        budgetCurrency: 'SAR',
        durationDays: 7,
        adults: 2,
        children: 2,
      },
    }

    it('TravelerIntentAnalyzer', () => {
      const r = analyzeTravelerIntent(input)
      assertSlice(r)
      expect(r.intent).toBe('discover')
      expect(r.purposeHint).toBe('family')
      expect(TravelerIntentAnalyzer.analyze(input).intent).toBe(r.intent)
    })

    it('TravelerProfileBuilder', () => {
      const r = buildTravelerProfile(input)
      assertSlice(r)
      expect(r.profile.purpose).toBe('family')
      expect(r.profile.riskTolerance).toBe('low')
      expect(TravelerProfileBuilder.build(input).profile.purpose).toBe('family')
    })

    it('ConstraintAnalyzer', () => {
      const r = analyzeConstraints(input)
      assertSlice(r)
      expect(r.constraints.hard.some((h) => h.startsWith('duration_days'))).toBe(true)
      expect(ConstraintAnalyzer.analyze(input).constraints.soft.length).toBeGreaterThan(0)
    })

    it('DestinationReasoner', () => {
      const r = reasonAboutDestination(input)
      assertSlice(r)
      expect(r.destinationFit.openEnded).toBe(true)
      expect(r.destinationFit.alternativesToConsider.length).toBeGreaterThan(0)
      expect(DestinationReasoner.reason(input).destinationFit.openEnded).toBe(true)
    })

    it('BudgetReasoner', () => {
      const r = reasonAboutBudget(input)
      assertSlice(r)
      expect(r.budget.amount).toBe(12000)
      expect(r.budget.valueOverCheapest).toBe(true)
      expect(BudgetReasoner.reason(input).budget.currency).toBe('SAR')
    })

    it('RiskReasoner', () => {
      const r = reasonAboutRisk(input)
      assertSlice(r)
      expect(r.risks.identified.length).toBeGreaterThan(0)
      expect(r.risks.mitigations.length).toBeGreaterThan(0)
      expect(RiskReasoner.reason(input).risks.tolerance).toBe('low')
    })

    it('ValueReasoner', () => {
      const r = reasonAboutValue(input)
      assertSlice(r)
      expect(r.value.drivers.length).toBeGreaterThan(0)
      expect(r.value.cheapnessCost.length).toBeGreaterThan(0)
      expect(ValueReasoner.reason(input).value.expectedValueSummary).toMatch(/value|cheap/i)
    })

    it('RecommendationReasoner answers Why / Why not / Alternative / Tradeoffs / Risk / Expected value', () => {
      const r = reasonAboutRecommendation(input)
      assertSlice(r)
      const answers = formatConsultantAnswers(r)
      expect(answers.why.length).toBeGreaterThan(0)
      expect(answers.whyNot.length).toBeGreaterThan(0)
      expect(answers.alternative.length).toBeGreaterThan(0)
      expect(answers.tradeoffs.length).toBeGreaterThan(0)
      expect(answers.risk.length).toBeGreaterThan(0)
      expect(answers.expectedValue.length).toBeGreaterThan(0)
      expect(RecommendationReasoner.reason(input).recommendation.primaryAction).toBeTruthy()
    })

    it('ExplanationGenerator', () => {
      const r = generateExplanation(input)
      assertSlice(r)
      expect(r.explanation.locale).toBe('en')
      expect(r.explanation.body.length).toBe(6)
      expect(r.explanation.headline).toBeTruthy()
      expect(ExplanationGenerator.generate(input).explanation.nextStep).toBeTruthy()
    })
  })

  describe('Arabic examples', () => {
    it('discovers family intent and builds Arabic explanation', () => {
      const input = {
        locale: 'ar' as const,
        userText: 'وش تنصح لرحلة عائلية آمنة مع أطفال؟ ميزانية مرنة حوالي ١٥ ألف',
        known: { budgetAmount: 15000, budgetCurrency: 'SAR' },
      }
      const pipeline = runConsultantReasoningPipeline(input)
      expect(pipeline.locale).toBe('ar')
      expect(pipeline.intent.purposeHint).toBe('family')
      expect(pipeline.intent.intent).toBe('discover')
      expect(pipeline.explanation.explanation.locale).toBe('ar')
      expect(pipeline.explanation.explanation.body[0]).toMatch(/^لماذا/)
      expect(pipeline.recommendation.recommendation.why.length).toBeGreaterThan(0)
      assertSlice(pipeline.overall)
    })

    it('plans when destination and duration known', () => {
      const pipeline = ReasoningPipeline.run({
        locale: 'ar',
        userText: 'أبي خطة لإسطنبول ٧ أيام',
        known: {
          destination: 'Istanbul',
          durationDays: 7,
          budgetAmount: 10000,
          budgetCurrency: 'SAR',
          adults: 2,
        },
      })
      expect(pipeline.intent.intent).toBe('plan')
      expect(pipeline.destination.destinationFit.statedDestination).toBe('Istanbul')
      expect(pipeline.recommendation.recommendation.primaryAction).toBe('proceed_planning')
    })
  })

  describe('English examples', () => {
    it('honeymoon discovery with comfort stance', () => {
      const pipeline = runConsultantReasoningPipeline({
        locale: 'en',
        userText: 'Suggest a romantic honeymoon, luxury preferred, not just the cheapest',
      })
      expect(pipeline.intent.purposeHint).toBe('honeymoon')
      expect(pipeline.profile.profile.budgetStance).toBe('comfort_first')
      expect(pipeline.value.value.drivers.some((d) => /atmosphere|recovery|purpose/i.test(d))).toBe(true)
      expect(pipeline.explanation.explanation.body[0]).toMatch(/^Why:/)
    })

    it('compare intent yields compare_options', () => {
      const pipeline = runConsultantReasoningPipeline({
        locale: 'en',
        userText: 'Compare Istanbul vs Baku for a cultural week',
      })
      expect(pipeline.intent.intent).toBe('compare')
      expect(pipeline.recommendation.recommendation.primaryAction).toBe('compare_options')
    })
  })

  describe('pipeline', () => {
    it('returns all modules and overall rollup', () => {
      const result = runConsultantReasoningPipeline({
        locale: 'en',
        userText: 'Where should we go for a relaxed beach trip?',
      })
      expect(result.intent).toBeTruthy()
      expect(result.profile).toBeTruthy()
      expect(result.constraints).toBeTruthy()
      expect(result.destination).toBeTruthy()
      expect(result.budget).toBeTruthy()
      expect(result.risk).toBeTruthy()
      expect(result.value).toBeTruthy()
      expect(result.recommendation).toBeTruthy()
      expect(result.explanation).toBeTruthy()
      assertSlice(result.overall)
      expect(result.overall.missingInformation.length).toBeGreaterThan(0)
    })

    it('is deterministic for the same input', () => {
      const input = {
        locale: 'en' as const,
        userText: 'Adventure trip ideas under 8000 SAR',
        known: { budgetAmount: 8000, budgetCurrency: 'SAR' },
      }
      const a = runConsultantReasoningPipeline(input)
      const b = runConsultantReasoningPipeline(input)
      expect(a.recommendation.recommendation.primaryAction).toBe(
        b.recommendation.recommendation.primaryAction,
      )
      expect(a.overall.recommendationScore).toBe(b.overall.recommendationScore)
      expect(a.explanation.explanation.headline).toBe(b.explanation.explanation.headline)
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn hooks from reasoning index', async () => {
      const mod = await import('../agent/reasoning')
      expect('planTurn' in mod).toBe(false)
      expect('runPlanTurn' in mod).toBe(false)
      expect(typeof mod.runTravelReasoning).toBe('function')
      expect(typeof mod.runConsultantReasoningPipeline).toBe('function')
      expect(typeof mod.isTravelReasoningEnabled).toBe('function')
      expect(typeof mod.isConsultantReasoningEnabled).toBe('function')
    })

    it('Sprint 45 travel reasoning remains independently callable', () => {
      expect(isTravelReasoningEnabled({ enabled: true })).toBe(true)
      const result = runTravelReasoning({
        locale: 'en',
        requirements: emptyRequirements(),
        userText: 'Suggest a warm beach destination',
      })
      expect(result).toBeTruthy()
      expect(result.mode).toBeTruthy()
    })

    it('strict budget does not invent destination locks', () => {
      const r = reasonAboutDestination({
        locale: 'en',
        userText: 'I have a tight budget of 3000 SAR',
        known: { budgetAmount: 3000, budgetCurrency: 'SAR' },
      })
      expect(r.destinationFit.statedDestination).toBeNull()
      expect(
        r.destinationFit.suitabilityNotes.some((n) => /No destination stated|Open-ended/i.test(n)),
      ).toBe(true)
    })
  })
})
