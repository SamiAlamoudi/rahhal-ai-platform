/**
 * Phase 2 Stage 3 — Unified Consultant Response aggregation tests.
 * New tests only — does not modify existing tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  CONSULTANT_RESPONSE_FEATURE_ID,
  aggregateConsultantResponse,
  buildConsultantResponseFormats,
  buildConsultantResponsePackage,
  enrichTurnWithConsultantResponse,
  getConsultantResponseTelemetry,
  isConsultantResponseEnabled,
  resetConsultantResponseTelemetry,
  runConsultantPipeline,
  tryBuildConsultantResponsePackage,
} from '../agent/orchestrator'
import type { AgentMemory, AgentProviderMeta } from '../agent/types'
import { emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'c-stage3',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  }
}

describe('Phase 2 Stage 3 — Unified Consultant Response', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConsultantResponseTelemetry()
  })

  describe('feature gate', () => {
    it('registers ai.consultant_response default OFF', () => {
      expect(getFeatureRegistry().isEnabled(CONSULTANT_RESPONSE_FEATURE_ID)).toBe(false)
      expect(isConsultantResponseEnabled()).toBe(false)
    })

    it('tryBuild returns null when flag off', async () => {
      const pipeline = await runConsultantPipeline({
        locale: 'en',
        userText: 'Family trip to Japan',
        known: { destination: 'Japan', budgetAmount: 20000, durationDays: 10 },
        enabled: true,
        minConfidence: 0.1,
      })
      expect(tryBuildConsultantResponsePackage(pipeline)).toBeNull()
      expect(
        tryBuildConsultantResponsePackage(pipeline, { enabled: true }),
      ).not.toBeNull()
    })
  })

  describe('aggregation from intelligence layers', () => {
    it('produces full body fields and all four formats', async () => {
      const pipeline = await runConsultantPipeline({
        locale: 'en',
        userText:
          'Relaxed family trip to Japan in April for 10 days, budget 20000 SAR',
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

      const aggregated = aggregateConsultantResponse(pipeline)
      expect(aggregated.sources).toEqual(
        expect.arrayContaining([
          'traveler_intelligence',
          'destination_intelligence',
          'travel_strategy',
          'recommendation_intelligence',
          'reflection',
          'planning_graph',
        ]),
      )

      const pkg = buildConsultantResponsePackage(pipeline)
      const body = pkg.body
      expect(body.executiveSummary.length).toBeGreaterThan(0)
      expect(body.travelerUnderstanding.length).toBeGreaterThan(0)
      expect(body.destinationUnderstanding.length).toBeGreaterThan(0)
      expect(body.recommendedStrategy.length).toBeGreaterThan(0)
      expect(body.primaryRecommendation.length).toBeGreaterThan(0)
      expect(Array.isArray(body.alternativeRecommendation)).toBe(true)
      expect(Array.isArray(body.tradeoffs)).toBe(true)
      expect(Array.isArray(body.benefits)).toBe(true)
      expect(Array.isArray(body.risks)).toBe(true)
      expect(Array.isArray(body.opportunityCost)).toBe(true)
      expect(typeof body.confidenceScore).toBe('number')
      expect(Array.isArray(body.evidenceSummary)).toBe(true)
      expect(Array.isArray(body.missingInformation)).toBe(true)
      expect(Array.isArray(body.clarificationQuestions)).toBe(true)

      expect(pkg.formats.executive.kind).toBe('executive')
      expect(pkg.formats.short.kind).toBe('short')
      expect(pkg.formats.detailed.kind).toBe('detailed')
      expect(pkg.formats.consultant.kind).toBe('consultant')
      expect(pkg.formats.detailed.sections.length).toBeGreaterThan(5)
      expect(pkg.telemetry.success).toBe(true)
      expect(pkg.telemetry.responseGenerationMs).toBeGreaterThanOrEqual(0)
      expect(pkg.telemetry.aggregationMs).toBeGreaterThanOrEqual(0)
    })

    it('low confidence surfaces missing info and questions without inventing destinations', async () => {
      const pipeline = await runConsultantPipeline({
        locale: 'en',
        userText: 'I want to travel somewhere nice',
        known: { budgetAmount: 5000, durationDays: 5 },
        enabled: true,
        minConfidence: 0.35,
      })
      const pkg = buildConsultantResponsePackage(pipeline, { minConfidence: 0.35 })
      expect(pkg.lowConfidence || pkg.body.clarificationQuestions.length > 0).toBe(true)
      const joined = [
        ...pkg.body.executiveSummary,
        ...pkg.body.primaryRecommendation,
        ...pkg.body.recommendedStrategy,
      ].join(' ')
      // Must not invent a concrete destination name when none was provided
      expect(joined.toLowerCase()).not.toMatch(/\b(paris|tokyo|bali|dubai)\b/)
      if (pkg.lowConfidence) {
        expect(
          pkg.body.missingInformation.length + pkg.body.clarificationQuestions.length,
        ).toBeGreaterThan(0)
      }
    })

    it('format builders are pure and locale-aware', () => {
      const body = {
        executiveSummary: ['Summary'],
        travelerUnderstanding: ['Family'],
        destinationUnderstanding: ['Japan'],
        recommendedStrategy: ['Go in spring'],
        primaryRecommendation: ['Japan family week'],
        alternativeRecommendation: ['Shorter stay'],
        tradeoffs: ['Pace vs coverage'],
        benefits: ['Culture'],
        risks: ['Crowds'],
        opportunityCost: ['Skip luxury hotels'],
        confidenceScore: 0.72,
        evidenceSummary: ['known:destination:Japan'],
        missingInformation: [],
        clarificationQuestions: [],
      }
      const en = buildConsultantResponseFormats(body, 'en', false)
      const ar = buildConsultantResponseFormats(body, 'ar', true)
      expect(en.executive.headline).toMatch(/Consultant/i)
      expect(ar.executive.headline).toMatch(/توضيح|توصية/)
      expect(ar.detailed.sections[0]?.title).toBeTruthy()
    })
  })

  describe('planTurn activation', () => {
    it('does not attach consultantResponse while flag OFF', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-stage3-off',
        messages: [user('Honeymoon in Bali.')],
      })
      expect(turn.meta.consultantResponse).toBeUndefined()
      expect(turn.meta.consultantPipeline).toBeUndefined()
    })

    it('attaches consultantResponse when forced ON without mutating plan', async () => {
      const service = createTravelAgentService({
        consultantResponseEnabled: true,
        consultantPipelineEnabled: false,
      })
      const turn = await service.planTurn({
        conversationId: 'c-stage3-on',
        messages: [user(COMPLETE_JAPAN_7D)],
      })
      expect(turn.meta.consultantResponse).toBeTruthy()
      expect(turn.meta.consultantPipeline).toBeUndefined()
      expect(turn.meta.consultantResponse?.formats.executive).toBeTruthy()
      expect(turn.meta.consultantResponse?.body.travelerUnderstanding.length).toBeGreaterThan(0)
      expect(turn.tripPlan?.destinations.some((d) => /japan/i.test(d))).toBe(true)
      expect(turn.reply.length).toBeGreaterThan(0)
    })

    it('enrichTurn is identity when disabled', async () => {
      const requirements = {
        ...emptyRequirements(),
        destination: 'Japan',
        durationDays: 7,
        budgetAmount: 15000,
      }
      const memory: AgentMemory = {
        locale: 'en',
        phase: 'collecting',
        requirements,
        tripPlan: null,
        itinerary: null,
        missingFields: [],
        lastIntent: 'plan',
      }
      const turn = {
        reply: 'KEEP',
        memory,
        tripPlan: null as null,
        meta: {
          kind: 'travel_agent' as const,
          version: 2 as const,
          memory,
          tripPlan: null,
          itinerary: null,
        } satisfies AgentProviderMeta,
        toolBatch: null,
      }
      const out = await enrichTurnWithConsultantResponse(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(getConsultantResponseTelemetry().runCount).toBe(0)
    })
  })

  describe('telemetry privacy', () => {
    it('does not store user text or emails', async () => {
      const pipeline = await runConsultantPipeline({
        locale: 'en',
        userText: 'PII_SECRET_TEXT_SHOULD_NOT_APPEAR',
        known: { destination: 'Japan', durationDays: 7, budgetAmount: 12000 },
        enabled: true,
        minConfidence: 0.1,
      })
      await enrichTurnWithConsultantResponse(
        {
          reply: 'x',
          memory: {
            locale: 'en',
            phase: 'collecting',
            requirements: {
              ...emptyRequirements(),
              destination: 'Japan',
              durationDays: 7,
              budgetAmount: 12000,
            },
            tripPlan: null,
            itinerary: null,
            missingFields: [],
            lastIntent: 'plan',
          },
          tripPlan: null,
          meta: {
            kind: 'travel_agent',
            version: 2,
            memory: {
              locale: 'en',
              phase: 'collecting',
              requirements: emptyRequirements(),
              tripPlan: null,
              itinerary: null,
              missingFields: [],
              lastIntent: 'plan',
            },
            tripPlan: null,
            itinerary: null,
          },
          toolBatch: null,
        },
        {
          userText: 'PII_SECRET_TEXT_SHOULD_NOT_APPEAR',
          conversationId: 'traveler@example.com',
          enabled: true,
          pipelineResult: pipeline,
        },
      )
      const snap = JSON.stringify(getConsultantResponseTelemetry())
      expect(snap).not.toContain('PII_SECRET_TEXT')
      expect(snap).not.toContain('traveler@example.com')
    })
  })
})
