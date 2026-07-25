/**
 * Phase 7 Stage 9 — Travel Ranking & Recommendation Engine architecture tests.
 * Contracts/blueprints only. No booking / providers / Runtime / scoring execution.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID,
  TRAVEL_RECOMMENDATION_ARCHITECTURE,
  TRAVEL_RECOMMENDATION_INPUT_HINTS,
  TRAVEL_RECOMMENDATION_PIPELINE_STAGES,
  TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS,
  TRAVEL_RECOMMENDATION_SECTION_IDS,
  TravelRecommendationEngine,
  TravelRecommendationRegistry,
  assertTravelRecommendationIsolation,
  buildTravelRecommendationBlueprint,
  isBrainTravelRecommendationEnabled,
  tryBuildTravelRecommendationBlueprint,
} from '../orchestration/travelRecommendationEngine'

describe('Phase 7 Stage 9 — Travel Ranking & Recommendation Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.travel_recommendation default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.search_orchestrator'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID),
      ).toBe(false)
      expect(isBrainTravelRecommendationEnabled()).toBe(false)
      expect(tryBuildTravelRecommendationBlueprint({})).toBeNull()
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.httpRequests).toBe(false)
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.wiredIntoProviderApis).toBe(
        false,
      )
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.booking).toBe(false)
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.pricing).toBe(false)
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(
        TRAVEL_RECOMMENDATION_ARCHITECTURE.distinctFromAiRecommendationEngine,
      ).toBe(true)
      expect(
        TRAVEL_RECOMMENDATION_ARCHITECTURE.distinctFromAiRecommendationIntelligence,
      ).toBe(true)
      expect(
        TRAVEL_RECOMMENDATION_ARCHITECTURE.distinctFromPersonalizationEngine,
      ).toBe(true)
      expect(getFeatureRegistry().get('brain.personalization_engine')?.id).toBe(
        'brain.personalization_engine',
      )
      expect(getFeatureRegistry().get('ai.recommendation_intelligence')?.id).toBe(
        'ai.recommendation_intelligence',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s9',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s9',
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
    it('exposes pipeline, dimensions, and components', () => {
      expect(assertTravelRecommendationIsolation().architectureOnly).toBe(true)
      expect(TravelRecommendationRegistry.list()).toHaveLength(
        TRAVEL_RECOMMENDATION_SECTION_IDS.length,
      )
      expect(TRAVEL_RECOMMENDATION_INPUT_HINTS).toEqual(
        expect.arrayContaining([
          'normalized_search_candidates',
          'traveler_profile',
          'intent',
          'preferences',
          'budget',
          'business_rules',
        ]),
      )
      expect(TRAVEL_RECOMMENDATION_PIPELINE_STAGES).toContain('score_candidates')
      expect(TRAVEL_RECOMMENDATION_PIPELINE_STAGES).toContain('rank_candidates')
      expect(TRAVEL_RECOMMENDATION_PIPELINE_STAGES).toContain('select_top')
      expect(TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS).toEqual(
        expect.arrayContaining([
          'profile_fit',
          'intent_fit',
          'budget_fit',
          'constraint_fit',
        ]),
      )
      expect(TRAVEL_RECOMMENDATION_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'recommendation_engine',
          'recommendation_pipeline',
          'recommendation_ranking',
          'recommendation_scoring',
          'top_recommendation_output',
          'alternative_recommendation_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelRecommendationBlueprint({
        enabled: true,
        sessionId: 'rec-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.engine.books).toBe(false)
      expect(blueprint?.engine.providerCalled).toBe(false)
      expect(blueprint?.scoring.executed).toBe(false)
      expect(blueprint?.revision.persisted).toBe(false)
      expect(blueprint?.confidence.confidence.bandHint).toBe('medium')
      expect(blueprint?.validation.validation.valid).toBe(true)
      expect(blueprint?.recommendationRanking.orderedCandidateIds).toHaveLength(0)
      expect(blueprint?.topRecommendation.candidateId).toBeNull()
      expect(blueprint?.alternativeRecommendations).toHaveLength(0)
      expect(blueprint?.registry).toHaveLength(
        TRAVEL_RECOMMENDATION_SECTION_IDS.length,
      )

      const direct = buildTravelRecommendationBlueprint({
        sessionId: 's2',
      })
      expect(direct.version).toBe('7.9.0-travel-recommendation')
      expect(
        TravelRecommendationEngine.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
