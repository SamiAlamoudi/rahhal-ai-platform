/**
 * Phase 7 Stage 3 — AI Personalization Engine architecture tests.
 * Contracts/blueprints only. No LLM / recommendation execution / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID,
  PERSONALIZATION_ENGINE_ARCHITECTURE,
  PERSONALIZATION_SECTION_IDS,
  PersonalizationEngine,
  PersonalizationRegistry,
  assertPersonalizationEngineIsolation,
  buildPersonalizationEngineBlueprint,
  isBrainPersonalizationEngineEnabled,
  tryBuildPersonalizationEngineBlueprint,
} from '../orchestration/personalizationEngine'

describe('Phase 7 Stage 3 — AI Personalization Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.personalization_engine default OFF', () => {
      const def = getFeatureRegistry().get(
        BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID,
      )
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.loyalty_foundation'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainPersonalizationEngineEnabled()).toBe(false)
      expect(tryBuildPersonalizationEngineBlueprint({})).toBeNull()
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.recommendationExecution).toBe(
        false,
      )
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.httpRequests).toBe(false)
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
      expect(
        PERSONALIZATION_ENGINE_ARCHITECTURE.distinctFromAiPersonalization,
      ).toBe(true)
      expect(
        PERSONALIZATION_ENGINE_ARCHITECTURE.distinctFromAiRecommendationEngine,
      ).toBe(true)
      expect(getFeatureRegistry().get('ai.personalization')?.id).toBe(
        'ai.personalization',
      )
      expect(getFeatureRegistry().get('ai.recommendation_engine')?.id).toBe(
        'ai.recommendation_engine',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s3',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s3',
            role: 'user',
            modality: 'text',
            content: 'Hello',
            audioUrl: null,
            imageUrl: null,
            attachments: [],
            status: 'complete',
            error: null,
            providerMeta: {},
            createdAt: '2026-07-25T00:00:00.000Z',
            updatedAt: '2026-07-25T00:00:00.000Z',
          },
        ],
      })
      expect(turn.reply.length).toBeGreaterThan(0)
      expect(turn.meta.experience).toBeUndefined()
    })
  })

  describe('contracts inventory', () => {
    it('exposes registry sections and architecture components', () => {
      expect(assertPersonalizationEngineIsolation().architectureOnly).toBe(true)
      expect(PersonalizationRegistry.list()).toHaveLength(
        PERSONALIZATION_SECTION_IDS.length,
      )
      expect(PERSONALIZATION_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'personalization_engine',
          'preference_learning',
          'behavior_learning',
          'recommendation_scoring',
          'destination_recommendation_contract',
          'conversation_tone_personalization_contract',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildPersonalizationEngineBlueprint({
        enabled: true,
        sessionId: 'pers-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.intentPrediction.predicted).toBe(false)
      expect(blueprint?.recommendationScoring.executed).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.preferenceConfidence.bandHint).toBe('medium')
      expect(blueprint?.profile.linkedTravelerProfileHint).toBe(true)
      expect(blueprint?.profile.linkedLoyaltyHint).toBe(true)
      expect(blueprint?.destinationRecommendation.execution).toBe('none')
      expect(blueprint?.hotelRecommendation.execution).toBe('none')
      expect(blueprint?.activityRecommendation.execution).toBe('none')
      expect(blueprint?.restaurantRecommendation.execution).toBe('none')
      expect(blueprint?.transportationRecommendation.execution).toBe('none')
      expect(blueprint?.conversationTone.execution).toBe('none')
      expect(blueprint?.offerPersonalization.execution).toBe('none')
      expect(blueprint?.registry).toHaveLength(PERSONALIZATION_SECTION_IDS.length)

      const direct = buildPersonalizationEngineBlueprint({ sessionId: 'p2' })
      expect(direct.version).toBe('7.3.0-personalization-engine')
      expect(
        PersonalizationEngine.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
