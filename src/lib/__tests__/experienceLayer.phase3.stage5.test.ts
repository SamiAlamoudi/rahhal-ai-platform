/**
 * Phase 3 Stage 5 — Experience Intelligence Layer tests.
 * New tests only — does not modify existing tests.
 * Layer is isolated (not wired into planTurn).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  EXPERIENCE_LAYER_FEATURE_ID,
  ExperienceComposer,
  composeExperience,
  enrichTurnWithExperienceLayer,
  isExperienceLayerEnabled,
  tryComposeExperience,
  EXPERIENCE_FUTURE_MODULES,
} from '../agent/experience'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'
import { emptyRequirements } from '../agent/types'

function user(content: string, conversationId = 'c-p3s5'): ChatMessage {
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

describe('Phase 3 Stage 5 — Experience Intelligence Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers ai.experience_layer default OFF', () => {
      expect(getFeatureRegistry().isEnabled(EXPERIENCE_LAYER_FEATURE_ID)).toBe(false)
      expect(isExperienceLayerEnabled()).toBe(false)
      expect(
        tryComposeExperience({
          conversationId: 'c-off',
          userText: 'Trip to Japan',
        }),
      ).toBeNull()
    })

    it('does not attach meta.experience from planTurn (not wired)', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p3s5-plan',
        messages: [user(COMPLETE_JAPAN_7D, 'c-p3s5-plan')],
      })
      expect(turn.meta.experience).toBeUndefined()
    })
  })

  describe('composeExperience', () => {
    it('builds UI-ready experience model from known cues', () => {
      const result = composeExperience({
        conversationId: 'c-compose',
        userText: 'Family trip to Japan for 10 days, budget 20000 SAR',
        locale: 'en',
        enabled: true,
        memoryContext: {
          locale: 'en',
          requirements: {
            ...emptyRequirements(),
            destination: 'Japan',
            budgetAmount: 20000,
            budgetCurrency: 'SAR',
            durationDays: 10,
            travelers: 2,
            tripPurpose: 'family',
            interests: ['food', 'culture'],
          },
        },
        travelIntelligence: {
          overallConfidence: 0.72,
          explanation: 'Japan leads on comparative fit.',
          ranked: [
            { destination: 'Japan', rank: 1 },
            { destination: 'Korea', rank: 2 },
          ],
        },
        proactiveAdvisor: {
          recommendations: [{ title: 'Visa reminder', message: 'Check entry rules' }],
        },
      })

      expect(result.enabled).toBe(true)
      expect(result.experience.summary.destination).toBe('Japan')
      expect(result.experience.summary.durationDays).toBe(10)
      expect(result.experience.tripHighlights.length).toBeGreaterThan(0)
      expect(result.experience.timeline.length).toBeGreaterThan(0)
      expect(result.experience.placeholders.weather.kind).toBe('weather_placeholder')
      expect(result.experience.placeholders.visa.kind).toBe('visa_placeholder')
      expect(result.experience.recommendedAlternatives.some((c) => /korea/i.test(c.body + c.title))).toBe(
        true,
      )
      expect(result.experience.importantAlerts.length).toBeGreaterThan(0)
      expect(result.experience.sections.length).toBeGreaterThan(0)
      expect(result.experience.confidence).toBeGreaterThan(0)
      expect(result.voice.prepared).toBe(true)
      expect(result.voice.session?.status).toBe('idle')
      expect(result.knowledge.books).toEqual([])
      expect(result.futureModules.length).toBe(EXPERIENCE_FUTURE_MODULES.length)
    })

    it('exposes placeholders without fetching external APIs', () => {
      const result = composeExperience({
        conversationId: 'c-ph',
        userText: 'hello',
        locale: 'en',
        enabled: true,
      })
      const p = result.experience.placeholders
      for (const card of Object.values(p)) {
        expect(card.tags).toContain('placeholder')
        expect(card.body.toLowerCase()).toMatch(/no external|coming soon|presentation slot/)
      }
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
      const out = enrichTurnWithExperienceLayer(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(out.reply).toBe('KEEP')
    })

    it('attaches meta.experience without mutating reply or tripPlan', () => {
      const memory = {
        locale: 'en',
        phase: 'collecting' as const,
        requirements: {
          ...emptyRequirements(),
          destination: 'Japan',
          budgetAmount: 20000,
          durationDays: 7,
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
      const out = enrichTurnWithExperienceLayer(turn, {
        userText: 'Trip to Japan for 7 days',
        conversationId: 'c-enrich',
        enabled: true,
      })
      expect(out.reply).toBe('ORIGINAL_REPLY')
      expect(out.tripPlan).toBe(tripPlan)
      expect(out.memory).toBe(memory)
      const exp = out.meta.experience as
        | {
            enabled: true
            experience: { summary: { destination: string | null } }
            voicePrepared: true
            knowledgePrepared: true
          }
        | undefined
      expect(exp?.enabled).toBe(true)
      expect(exp?.experience.summary.destination).toBe('Japan')
      expect(exp?.voicePrepared).toBe(true)
      expect(exp?.knowledgePrepared).toBe(true)
    })
  })

  describe('facade', () => {
    it('exposes ExperienceComposer helpers', () => {
      expect(ExperienceComposer.isEnabled()).toBe(false)
      expect(ExperienceComposer.featureId).toBe(EXPERIENCE_LAYER_FEATURE_ID)
    })
  })
})
