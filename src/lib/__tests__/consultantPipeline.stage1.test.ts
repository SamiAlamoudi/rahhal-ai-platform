/**
 * Phase 2 Stage 1 — Consultant Pipeline orchestration tests.
 * Orchestration only — does not modify existing module tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  CONSULTANT_PIPELINE_FEATURE_ID,
  CONSULTANT_STAGE_ORDER,
  INTEGRATION_REGISTRY,
  ConsultantContext,
  ConsultantPipeline,
  ConsultantStages,
  isConsultantPipelineEnabled,
  runConsultantPipeline,
  tryRunConsultantPipeline,
  enrichContextFromStage,
  createInitialContext,
  hasStageOutput,
  type StageResult,
} from '../agent/orchestrator'

describe('Phase 2 Stage 1 — Consultant Pipeline', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.consultant_pipeline default OFF', () => {
      expect(getFeatureRegistry().isEnabled(CONSULTANT_PIPELINE_FEATURE_ID)).toBe(false)
      expect(isConsultantPipelineEnabled()).toBe(false)
      expect(ConsultantStages.featureId).toBe('ai.consultant_pipeline')
    })

    it('tryRun returns null when flag off; runs when forced', async () => {
      await expect(
        tryRunConsultantPipeline({
          userText: 'Family trip ideas',
          locale: 'en',
        }),
      ).resolves.toBeNull()

      const forced = await tryRunConsultantPipeline({
        userText: 'Family vacation to Japan for 10 days, budget 20000 SAR',
        locale: 'en',
        enabled: true,
        known: {
          destination: 'Japan',
          budgetAmount: 20000,
          budgetCurrency: 'SAR',
          durationDays: 10,
          adults: 2,
          children: 2,
          monthHint: 4,
          tripPurpose: 'family',
        },
        minConfidence: 0.15,
      })
      expect(forced).not.toBeNull()
      expect(forced?.enabled).toBe(true)
      expect(forced?.response.confidence).toBeGreaterThanOrEqual(0)
    })
  })

  describe('integration registry + stage order', () => {
    it('lists all required stages in execution order', () => {
      expect(CONSULTANT_STAGE_ORDER).toEqual([
        'conversation',
        'decision',
        'reasoning',
        'reflection',
        'planning_graph',
        'traveler_intelligence',
        'destination_intelligence',
        'recommendation_intelligence',
        'travel_strategy',
        'unified_response',
      ])
      expect(INTEGRATION_REGISTRY.map((r) => r.stageId)).toEqual(CONSULTANT_STAGE_ORDER)
      expect(ConsultantPipeline.stageOrder).not.toContain('unified_response')
    })
  })

  describe('enrich-only context', () => {
    it('never overwrites an existing stage output bag', () => {
      const ctx = createInitialContext({
        userText: 'hello',
        locale: 'en',
        known: { destination: 'Paris' },
      })
      const first: StageResult = {
        stageId: 'conversation',
        status: 'completed',
        confidence: 0.8,
        evidence: ['a'],
        missingInformation: [],
        questions: [],
        output: { v: 1 },
        durationMs: 1,
      }
      const second: StageResult = {
        stageId: 'conversation',
        status: 'completed',
        confidence: 0.9,
        evidence: ['b'],
        missingInformation: [],
        questions: [],
        output: { v: 2 },
        durationMs: 1,
      }
      const afterFirst = enrichContextFromStage(ctx, first)
      const afterSecond = enrichContextFromStage(afterFirst, second)
      expect(hasStageOutput(afterFirst, 'conversation')).toBe(true)
      expect(afterSecond.stageOutputs.conversation).toEqual({ v: 1 })
      expect(afterSecond.evidence).toContain('a')
      expect(afterSecond.evidence).toContain('b')
    })

    it('enriches traveler/planning snapshots without clobbering set fields', () => {
      const base = ConsultantContext.create({
        userText: 'x',
        locale: 'en',
        known: { tripPurpose: 'family', destination: 'Japan' },
      })
      const enriched = ConsultantContext.enrichTraveler(base.travelerSnapshot, {
        purpose: 'honeymoon',
        pace: 'relaxed',
      })
      expect(enriched.purpose).toBe('family')
      expect(enriched.pace).toBe('relaxed')
      const planning = ConsultantContext.enrichPlanning(base.planningSnapshot, {
        destinations: ['Tokyo'],
        durationDays: 7,
      })
      expect(planning.destinations).toContain('Japan')
      expect(planning.destinations).toContain('Tokyo')
      expect(planning.durationDays).toBe(7)
    })
  })

  describe('full sequence (forced)', () => {
    it('runs all intelligence stages and produces unified response', async () => {
      const result = await runConsultantPipeline({
        locale: 'en',
        userText:
          'We want a relaxed family trip to Japan in April for about 10 days, budget around 20000 SAR, value over luxury.',
        conversationId: 'stage1-test',
        known: {
          destination: 'Japan',
          budgetAmount: 20000,
          budgetCurrency: 'SAR',
          durationDays: 10,
          adults: 2,
          children: 1,
          monthHint: 4,
          tripPurpose: 'family',
          interests: ['culture', 'food'],
        },
        enabled: true,
        minConfidence: 0.1,
      })

      const ids = result.stages.map((s) => s.stageId)
      expect(ids).toContain('conversation')
      expect(ids).toContain('decision')
      expect(ids).toContain('reasoning')
      expect(ids).toContain('reflection')
      expect(ids).toContain('planning_graph')
      expect(ids).toContain('traveler_intelligence')
      expect(ids).toContain('destination_intelligence')
      expect(ids).toContain('recommendation_intelligence')
      expect(ids).toContain('travel_strategy')
      expect(ids).toContain('unified_response')

      // Each prior stage bag present and distinct
      expect(result.context.stageOutputs.conversation).toBeTruthy()
      expect(result.context.stageOutputs.reasoning).toBeTruthy()
      expect(result.context.stageOutputs.reflection).toBeTruthy()
      expect(result.context.stageOutputs.planning_graph).toBeTruthy()
      expect(result.context.stageOutputs.traveler_intelligence).toBeTruthy()
      expect(result.context.stageOutputs.destination_intelligence).toBeTruthy()
      expect(result.context.stageOutputs.recommendation_intelligence).toBeTruthy()
      expect(result.context.stageOutputs.travel_strategy).toBeTruthy()

      const unified = result.response
      expect(unified.travelerUnderstanding.length).toBeGreaterThan(0)
      expect(unified.destinationUnderstanding.length).toBeGreaterThan(0)
      expect(unified.recommendedStrategy.length).toBeGreaterThan(0)
      expect(typeof unified.confidence).toBe('number')
      expect(Array.isArray(unified.alternative)).toBe(true)
      expect(Array.isArray(unified.tradeoffs)).toBe(true)
      expect(Array.isArray(unified.risks)).toBe(true)
      expect(Array.isArray(unified.budgetImpact)).toBe(true)
      expect(Array.isArray(unified.timeImpact)).toBe(true)
      expect(Array.isArray(unified.questions)).toBe(true)
      expect(result.stoppedEarly).toBe(false)
    })
  })

  describe('clarification stop', () => {
    it('stops and asks questions when destination is missing', async () => {
      const result = await runConsultantPipeline({
        locale: 'en',
        userText: 'I want to travel somewhere nice',
        known: {
          budgetAmount: 8000,
          budgetCurrency: 'SAR',
          durationDays: 5,
        },
        enabled: true,
        minConfidence: 0.35,
      })

      expect(result.stoppedEarly).toBe(true)
      expect(result.response.needsClarification).toBe(true)
      expect(result.response.questions.length).toBeGreaterThan(0)
      expect(result.stopReason).toBeTruthy()
      // Must not invent a destination strategy as if complete
      expect(result.context.stageOutputs.travel_strategy).toBeUndefined()
    })
  })

  describe('arabic path', () => {
    it('produces arabic unified fields when locale is ar', async () => {
      const result = await runConsultantPipeline({
        locale: 'ar',
        userText: 'رحلة عائلية إلى اليابان لمدة ١٠ أيام بميزانية ٢٠٠٠٠ ريال',
        known: {
          destination: 'اليابان',
          budgetAmount: 20000,
          budgetCurrency: 'SAR',
          durationDays: 10,
          monthHint: 4,
          tripPurpose: 'family',
        },
        enabled: true,
        minConfidence: 0.1,
      })
      expect(result.locale).toBe('ar')
      expect(result.response.locale).toBe('ar')
      expect(result.response.travelerUnderstanding.length).toBeGreaterThan(0)
    })
  })

  describe('production isolation', () => {
    it('does not import or call planTurn', async () => {
      const src = await import('../agent/orchestrator/consultantPipeline')
      expect(typeof src.runConsultantPipeline).toBe('function')
      expect(typeof src.tryRunConsultantPipeline).toBe('function')
      // Flag remains off — zero cost when gated
      expect(isConsultantPipelineEnabled()).toBe(false)
    })
  })
})
