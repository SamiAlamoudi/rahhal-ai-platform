/**
 * Phase 3 Stage 4 — Travel Intelligence Layer tests.
 * New tests only — does not modify existing tests.
 * Layer is isolated (not wired into planTurn).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  TRAVEL_INTELLIGENCE_FEATURE_ID,
  TravelIntelligence,
  analyzeTravelTradeoffs,
  compareTravelAlternatives,
  enrichTurnWithTravelIntelligence,
  isTravelIntelligenceEnabled,
  rankTravelAlternatives,
  runTravelIntelligence,
  tryRunTravelIntelligence,
  buildIntelligenceContext,
  generateTravelAlternatives,
} from '../agent/intelligence'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'
import { emptyRequirements } from '../agent/types'

function user(content: string, conversationId = 'c-p3s4'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
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

describe('Phase 3 Stage 4 — Travel Intelligence Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers ai.travel_intelligence default OFF', () => {
      expect(getFeatureRegistry().isEnabled(TRAVEL_INTELLIGENCE_FEATURE_ID)).toBe(false)
      expect(isTravelIntelligenceEnabled()).toBe(false)
      expect(
        tryRunTravelIntelligence({
          conversationId: 'c-off',
          userText: 'Trip to Japan',
        }),
      ).toBeNull()
    })

    it('does not attach travelIntelligence from planTurn (not wired)', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p3s4-plan',
        messages: [user(COMPLETE_JAPAN_7D, 'c-p3s4-plan')],
      })
      expect(turn.meta.travelIntelligence).toBeUndefined()
    })
  })

  describe('alternatives + comparison', () => {
    it('generates alternatives and compares dimensions', () => {
      const context = buildIntelligenceContext({
        conversationId: 'c1',
        userText: 'Family trip to Japan for 10 days, budget 20000 SAR',
        locale: 'en',
      })
      const alternatives = generateTravelAlternatives({ context })
      expect(alternatives.length).toBeGreaterThanOrEqual(2)
      expect(alternatives[0]?.destination).toBe('Japan')

      const comparisons = compareTravelAlternatives({ alternatives, context })
      expect(comparisons).toHaveLength(alternatives.length)
      expect(comparisons[0]?.dimensions.length).toBeGreaterThan(0)
      expect(comparisons[0]?.overallScore).toBeGreaterThanOrEqual(0)
    })

    it('analyzes trade-offs between alternatives', () => {
      const context = buildIntelligenceContext({
        conversationId: 'c1',
        userText: 'Business trip to Dubai',
        locale: 'en',
      })
      const alternatives = generateTravelAlternatives({ context })
      const comparisons = compareTravelAlternatives({ alternatives, context })
      const tradeoffs = analyzeTravelTradeoffs({
        alternatives,
        comparisons,
        locale: 'en',
      })
      expect(tradeoffs.length).toBeGreaterThan(0)
      expect(tradeoffs[0]?.summary.length).toBeGreaterThan(0)
      expect(tradeoffs[0]?.between).toHaveLength(2)
    })
  })

  describe('runTravelIntelligence', () => {
    it('ranks recommendations with confidence and justification', () => {
      const result = runTravelIntelligence({
        conversationId: 'c-run',
        userText: 'Family trip to Japan in April, budget 20000 SAR, 10 days',
        locale: 'en',
        enabled: true,
      })
      expect(result.enabled).toBe(true)
      expect(result.alternatives.length).toBeGreaterThanOrEqual(2)
      expect(result.ranked.length).toBe(result.alternatives.length)
      expect(result.ranked[0]?.rank).toBe(1)
      expect(result.ranked[0]?.justification.length).toBeGreaterThan(0)
      expect(result.overallConfidence).toBeGreaterThan(0)
      expect(result.explanation.length).toBeGreaterThan(0)
      expect(result.primaryId).toBeTruthy()
      expect(result.voiceSummary?.speakableSummary).toBeTruthy()
      expect(result.knowledgeRefs[0]?.optional).toBe(true)
      expect(result.memoryAppend.every((m) => m.mode === 'append')).toBe(true)
      // Never invent absolute visa/price claims
      expect(result.explanation.toLowerCase()).not.toMatch(/visa approved|fare is \$\d/)
    })

    it('returns empty alternatives when no destination cue exists', () => {
      const result = runTravelIntelligence({
        conversationId: 'c-empty',
        userText: 'hello there',
        locale: 'en',
        enabled: true,
      })
      expect(result.alternatives).toHaveLength(0)
      expect(result.ranked).toHaveLength(0)
      expect(result.primaryId).toBeNull()
    })

    it('ranking engine orders by decision score', () => {
      const ranked = rankTravelAlternatives({
        alternatives: [
          {
            id: 'a',
            label: 'A',
            destination: 'A',
            priceSignal: 0.5,
            durationDays: 7,
            convenience: 0.5,
            visaDifficulty: 0.5,
            weatherSuitability: 0.5,
            familyFriendliness: 0.5,
            businessSuitability: 0.5,
            accessibility: 0.5,
            preferenceFit: 0.5,
            conversationFit: 0.5,
            notes: [],
          },
          {
            id: 'b',
            label: 'B',
            destination: 'B',
            priceSignal: 0.5,
            durationDays: 7,
            convenience: 0.5,
            visaDifficulty: 0.5,
            weatherSuitability: 0.5,
            familyFriendliness: 0.5,
            businessSuitability: 0.5,
            accessibility: 0.5,
            preferenceFit: 0.5,
            conversationFit: 0.5,
            notes: [],
          },
        ],
        decisionScores: [
          { alternativeId: 'a', decisionScore: 0.4 },
          { alternativeId: 'b', decisionScore: 0.9 },
        ],
        confidences: [
          { alternativeId: 'a', confidence: 0.5 },
          { alternativeId: 'b', confidence: 0.7 },
        ],
        tradeoffs: [],
        justifications: [
          { alternativeId: 'a', justification: 'A fit' },
          { alternativeId: 'b', justification: 'B fit' },
        ],
      })
      expect(ranked[0]?.alternativeId).toBe('b')
      expect(ranked[0]?.rank).toBe(1)
      expect(ranked[1]?.alternativeId).toBe('a')
    })
  })

  describe('enrichTurn meta-only', () => {
    it('is identity when disabled', () => {
      const memory = {
        locale: 'en',
        phase: 'collecting' as const,
        requirements: { ...emptyRequirements(), destination: 'Japan' },
        tripPlan: null,
        itinerary: null,
        missingFields: [] as [],
        lastIntent: 'plan' as const,
      }
      const turn = {
        reply: 'KEEP',
        memory,
        tripPlan: { destinations: ['Japan'] },
        meta: {
          kind: 'travel_agent' as const,
          version: 2 as const,
          memory,
          tripPlan: null,
          itinerary: null,
        },
        toolBatch: null,
      }
      const out = enrichTurnWithTravelIntelligence(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(out.reply).toBe('KEEP')
    })

    it('attaches meta.travelIntelligence without mutating reply or tripPlan', () => {
      const memory = {
        locale: 'en',
        phase: 'collecting' as const,
        requirements: {
          ...emptyRequirements(),
          destination: 'Japan',
          budgetAmount: 20000,
          durationDays: 10,
        },
        tripPlan: null,
        itinerary: null,
        missingFields: [] as [],
        lastIntent: 'plan' as const,
      }
      const tripPlan = { destinations: ['Japan'], days: [] as unknown[] }
      const turn = {
        reply: 'ORIGINAL_REPLY',
        memory,
        tripPlan,
        meta: {
          kind: 'travel_agent' as const,
          version: 2 as const,
          memory,
          tripPlan: null,
          itinerary: null,
        } as Record<string, unknown>,
        toolBatch: null,
      }
      const out = enrichTurnWithTravelIntelligence(turn, {
        userText: 'Family trip to Japan for 10 days, budget 20000 SAR',
        conversationId: 'c-enrich',
        enabled: true,
      })
      expect(out.reply).toBe('ORIGINAL_REPLY')
      expect(out.tripPlan).toBe(tripPlan)
      expect(out.memory).toBe(memory)
      const intel = out.meta.travelIntelligence as
        | {
            enabled: true
            rankedCount: number
            explanation: string
            ranked: Array<{ destination: string }>
          }
        | undefined
      expect(intel?.enabled).toBe(true)
      expect(intel?.rankedCount).toBeGreaterThan(0)
      expect(intel?.explanation.length).toBeGreaterThan(0)
      expect(intel?.ranked.some((r) => /japan/i.test(r.destination))).toBe(true)
    })
  })

  describe('facade', () => {
    it('exposes TravelIntelligence helpers', () => {
      expect(TravelIntelligence.isEnabled()).toBe(false)
      expect(TravelIntelligence.featureId).toBe(TRAVEL_INTELLIGENCE_FEATURE_ID)
    })
  })
})
