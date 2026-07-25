/**
 * Phase 7 Stage 10 — Offer Decision Engine architecture tests.
 * Contracts/blueprints only. No booking / providers / payments / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID,
  TRAVEL_OFFER_DECISION_ARCHITECTURE,
  TRAVEL_OFFER_DECISION_SECTION_IDS,
  TRAVEL_OFFER_INPUT_HINTS,
  TRAVEL_OFFER_PIPELINE_STAGES,
  TRAVEL_OFFER_SCORE_DIMENSIONS,
  TRAVEL_OFFER_STRATEGY_HINTS,
  TravelOfferDecisionEngine,
  TravelOfferDecisionRegistry,
  assertTravelOfferDecisionIsolation,
  buildTravelOfferDecisionBlueprint,
  isBrainOfferDecisionEngineEnabled,
  tryBuildTravelOfferDecisionBlueprint,
} from '../orchestration/travelOfferDecisionEngine'

describe('Phase 7 Stage 10 — Offer Decision Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.offer_decision_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.travel_recommendation'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainOfferDecisionEngineEnabled()).toBe(false)
      expect(tryBuildTravelOfferDecisionBlueprint({})).toBeNull()
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.httpRequests).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoProviderApis).toBe(
        false,
      )
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.booking).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.pricing).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.payments).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoOcr).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.wiredIntoAuth).toBe(false)
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.recommendationExecuted).toBe(
        false,
      )
      expect(
        TRAVEL_OFFER_DECISION_ARCHITECTURE.distinctFromTravelRecommendation,
      ).toBe(true)
      expect(
        TRAVEL_OFFER_DECISION_ARCHITECTURE.distinctFromPersonalizationEngine,
      ).toBe(true)
      expect(
        TRAVEL_OFFER_DECISION_ARCHITECTURE.distinctFromAiRecommendationEngine,
      ).toBe(true)
      expect(getFeatureRegistry().get('brain.travel_recommendation')?.id).toBe(
        'brain.travel_recommendation',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s10',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s10',
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
    it('exposes pipeline, strategies, and components', () => {
      expect(assertTravelOfferDecisionIsolation().architectureOnly).toBe(true)
      expect(TravelOfferDecisionRegistry.list()).toHaveLength(
        TRAVEL_OFFER_DECISION_SECTION_IDS.length,
      )
      expect(TRAVEL_OFFER_INPUT_HINTS).toEqual(
        expect.arrayContaining([
          'recommendation_results',
          'traveler_preferences',
          'price_signals',
          'quality_signals',
          'business_rules',
        ]),
      )
      expect(TRAVEL_OFFER_PIPELINE_STAGES).toContain('select_best_offer')
      expect(TRAVEL_OFFER_PIPELINE_STAGES).toContain('explain_decision')
      expect(TRAVEL_OFFER_STRATEGY_HINTS).toEqual(
        expect.arrayContaining([
          'best_overall',
          'best_value',
          'prefer_quality',
          'prefer_price',
          'business_rules_first',
        ]),
      )
      expect(TRAVEL_OFFER_SCORE_DIMENSIONS).toEqual(
        expect.arrayContaining([
          'price_fit',
          'quality_fit',
          'preference_fit',
          'business_rule_fit',
        ]),
      )
      expect(TRAVEL_OFFER_DECISION_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'offer_decision_engine',
          'offer_pipeline',
          'offer_strategy',
          'offer_scoring',
          'offer_ranking',
          'offer_decision_output',
          'offer_bundle_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelOfferDecisionBlueprint({
        enabled: true,
        sessionId: 'offer-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.engine.books).toBe(false)
      expect(blueprint?.engine.providerCalled).toBe(false)
      expect(blueprint?.engine.paymentsCalculated).toBe(false)
      expect(blueprint?.scoring.executed).toBe(false)
      expect(blueprint?.revision.persisted).toBe(false)
      expect(blueprint?.strategy.activeStrategyHint).toBeNull()
      expect(blueprint?.offerDecision.selectedCandidateId).toBeNull()
      expect(blueprint?.offerRanking.orderedCandidateIds).toHaveLength(0)
      expect(blueprint?.offerConfidence.bandHint).toBe('medium')
      expect(blueprint?.offerValidation.valid).toBe(true)
      expect(blueprint?.offerExplanation.reasonHints).toHaveLength(0)
      expect(blueprint?.registry).toHaveLength(
        TRAVEL_OFFER_DECISION_SECTION_IDS.length,
      )

      const direct = buildTravelOfferDecisionBlueprint({
        sessionId: 's2',
      })
      expect(direct.version).toBe('7.10.0-offer-decision')
      expect(
        TravelOfferDecisionEngine.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
