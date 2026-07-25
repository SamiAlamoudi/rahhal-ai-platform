/**
 * Phase 3 Stage 3 — Proactive Travel Advisor tests.
 * New tests only — does not modify existing tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  PROACTIVE_ADVISOR_FEATURE_ID,
  ProactiveAdvisor,
  buildProactiveContext,
  detectProactiveSignals,
  enrichTurnWithProactiveAdvisor,
  isProactiveAdvisorEnabled,
  runProactiveAdvisor,
  tryRunProactiveAdvisor,
} from '../agent/proactive'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'
import { emptyRequirements } from '../agent/types'

function user(content: string, conversationId = 'c-p3s3'): ChatMessage {
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

describe('Phase 3 Stage 3 — Proactive Travel Advisor', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.proactive_advisor default OFF', () => {
      expect(getFeatureRegistry().isEnabled(PROACTIVE_ADVISOR_FEATURE_ID)).toBe(false)
      expect(isProactiveAdvisorEnabled()).toBe(false)
      expect(
        tryRunProactiveAdvisor({
          conversationId: 'c-off',
          userText: 'Trip to Japan',
        }),
      ).toBeNull()
    })
  })

  describe('signal detection', () => {
    it('suggests visa-related tip when destination is mentioned', () => {
      const ctx = buildProactiveContext({
        conversationId: 'c1',
        userText: 'I want to visit Japan',
        locale: 'en',
      })
      const signals = detectProactiveSignals(ctx)
      expect(signals.some((s) => s.signal === 'visa_reminder')).toBe(true)
      expect(ctx.destination).toBe('Japan')
    })

    it('suggests weather tip when dates are mentioned', () => {
      const ctx = buildProactiveContext({
        conversationId: 'c1',
        userText: 'Traveling in April for 7 days',
        locale: 'en',
      })
      const signals = detectProactiveSignals(ctx)
      expect(signals.some((s) => s.signal === 'weather_notice')).toBe(true)
      expect(signals.some((s) => s.signal === 'season_advice')).toBe(true)
    })

    it('suggests budget opportunity when budget is mentioned', () => {
      const ctx = buildProactiveContext({
        conversationId: 'c1',
        userText: 'Our budget is 15000 SAR',
        locale: 'en',
      })
      const signals = detectProactiveSignals(ctx)
      expect(signals.some((s) => s.signal === 'budget_optimization')).toBe(true)
    })

    it('suggests family tips for family travel', () => {
      const ctx = buildProactiveContext({
        conversationId: 'c1',
        userText: 'Family trip to Bali with kids',
        locale: 'en',
      })
      const signals = detectProactiveSignals(ctx)
      expect(signals.some((s) => s.signal === 'family_travel')).toBe(true)
      expect(signals.some((s) => s.signal === 'transportation_reminder')).toBe(true)
    })

    it('suggests executive / meeting tips for business travel', () => {
      const ctx = buildProactiveContext({
        conversationId: 'c1',
        userText: 'Business trip to Dubai for client meetings',
        locale: 'en',
      })
      const signals = detectProactiveSignals(ctx)
      expect(signals.some((s) => s.signal === 'executive_travel')).toBe(true)
      expect(signals.some((s) => s.signal === 'meeting_logistics')).toBe(true)
    })
  })

  describe('recommendation shape + safety', () => {
    it('includes confidence, evidence, and never invents visa status', () => {
      const result = runProactiveAdvisor({
        conversationId: 'c-rec',
        userText: 'Plan Japan in April, budget 20000 SAR, family trip',
        locale: 'en',
        enabled: true,
      })
      expect(result.enabled).toBe(true)
      expect(result.recommendations.length).toBeGreaterThan(0)
      for (const rec of result.recommendations) {
        expect(rec.reason.length).toBeGreaterThan(0)
        expect(rec.confidence).toBeGreaterThanOrEqual(0)
        expect(rec.confidence).toBeLessThanOrEqual(1)
        expect(Array.isArray(rec.supportingEvidence)).toBe(true)
        expect(Array.isArray(rec.missingEvidence)).toBe(true)
        expect(typeof rec.clarificationRequired).toBe('boolean')
        expect(rec.message.toLowerCase()).not.toMatch(/visa (approved|granted)/)
        expect(rec.voiceHint?.speakableSummary).toBeTruthy()
        expect(rec.knowledgeRefs[0]?.optional).toBe(true)
        expect(rec.memoryAppend.every((m) => m.mode === 'append')).toBe(true)
      }
    })
  })

  describe('planTurn wiring', () => {
    it('does not attach proactiveAdvisor while flag OFF', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p3s3-off',
        messages: [user('Honeymoon in Bali.')],
      })
      expect(turn.meta.proactiveAdvisor).toBeUndefined()
    })

    it('attaches meta.proactiveAdvisor when forced ON without mutating plan or reply identity fields', async () => {
      const service = createTravelAgentService({ proactiveAdvisorEnabled: true })
      const turn = await service.planTurn({
        conversationId: 'c-p3s3-on',
        messages: [user(COMPLETE_JAPAN_7D, 'c-p3s3-on')],
      })
      expect(turn.meta.proactiveAdvisor).toBeTruthy()
      expect(turn.meta.proactiveAdvisor?.enabled).toBe(true)
      expect(turn.meta.proactiveAdvisor?.recommendationCount).toBeGreaterThan(0)
      expect(turn.meta.proactiveAdvisor?.signalsDetected.length).toBeGreaterThan(0)
      expect(turn.tripPlan?.destinations.some((d) => /japan/i.test(d))).toBe(true)
      expect(turn.reply.length).toBeGreaterThan(0)
    })

    it('enrichTurn is identity when disabled', () => {
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
      const out = enrichTurnWithProactiveAdvisor(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(out.reply).toBe('KEEP')
      expect(out.tripPlan).toBe(turn.tripPlan)
    })

    it('enrichTurn preserves reply and tripPlan when enabled', () => {
      const memory = {
        locale: 'en',
        phase: 'collecting' as const,
        requirements: { ...emptyRequirements(), destination: 'Japan', budgetAmount: 10000 },
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
      const out = enrichTurnWithProactiveAdvisor(turn, {
        userText: 'Family trip to Japan in April, budget 10000 SAR',
        conversationId: 'c-preserve',
        enabled: true,
      })
      expect(out.reply).toBe('ORIGINAL_REPLY')
      expect(out.tripPlan).toBe(tripPlan)
      expect(out.memory).toBe(memory)
      const proactive = out.meta.proactiveAdvisor as
        | { enabled: true; recommendations: Array<{ signal: string }> }
        | undefined
      expect(proactive?.enabled).toBe(true)
      expect(proactive?.recommendations.some((r) => r.signal === 'visa_reminder')).toBe(true)
    })
  })

  describe('facade', () => {
    it('exposes ProactiveAdvisor helpers', () => {
      expect(ProactiveAdvisor.isEnabled()).toBe(false)
      expect(ProactiveAdvisor.featureId).toBe(PROACTIVE_ADVISOR_FEATURE_ID)
    })
  })
})
