/**
 * Phase 7 Stage 2 — Loyalty Platform Foundation architecture tests.
 * Contracts/blueprints only. No DB / payments / reward calculation / LLM.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_LOYALTY_PLATFORM_FEATURE_ID,
  LOYALTY_PLATFORM_ARCHITECTURE,
  LOYALTY_SECTION_IDS,
  LoyaltyPlatformFoundation,
  LoyaltyRegistry,
  MEMBERSHIP_LEVELS,
  assertLoyaltyPlatformIsolation,
  buildLoyaltyPlatformBlueprint,
  isBrainLoyaltyPlatformEnabled,
  tryBuildLoyaltyPlatformBlueprint,
} from '../orchestration/loyaltyPlatformFoundation'

describe('Phase 7 Stage 2 — Loyalty Platform Foundation (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.loyalty_platform default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_LOYALTY_PLATFORM_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.traveler_profile'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_LOYALTY_PLATFORM_FEATURE_ID),
      ).toBe(false)
      expect(isBrainLoyaltyPlatformEnabled()).toBe(false)
      expect(tryBuildLoyaltyPlatformBlueprint({})).toBeNull()
      expect(LOYALTY_PLATFORM_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.wiredIntoAuthentication).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.wiredIntoPayments).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.couponsLogic).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.rewardCalculation).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.httpRequests).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(LOYALTY_PLATFORM_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s2',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s2',
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
    it('exposes registry sections and membership levels', () => {
      expect(assertLoyaltyPlatformIsolation().architectureOnly).toBe(true)
      expect(LoyaltyRegistry.list()).toHaveLength(LOYALTY_SECTION_IDS.length)
      expect(MEMBERSHIP_LEVELS).toEqual(
        expect.arrayContaining([
          'explorer',
          'voyager',
          'navigator',
          'ambassador',
        ]),
      )
      expect(LOYALTY_PLATFORM_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'loyalty_account',
          'reward_catalog',
          'referral_program',
          'campaign_registry',
          'gamification_strategy_contract',
          'reward_recommendation_contract',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildLoyaltyPlatformBlueprint({
        enabled: true,
        sessionId: 'loy-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.account.execution).toBe('none')
      expect(blueprint?.rewardPoints.calculated).toBe(false)
      expect(blueprint?.rewardPoints.balanceHint).toBe(0)
      expect(blueprint?.pointLedger.persisted).toBe(false)
      expect(blueprint?.rewardRedemption.executed).toBe(false)
      expect(blueprint?.coupons.logic).toBe(false)
      expect(blueprint?.travelCredits.calculated).toBe(false)
      expect(blueprint?.referralProgram.activeHint).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.membershipStatus.status).toBe('inactive')
      expect(blueprint?.rewardRecommendation.execution).toBe('none')
      expect(blueprint?.offerPersonalization.execution).toBe('none')
      expect(blueprint?.rewardEligibility.execution).toBe('none')
      expect(blueprint?.campaignDecision.execution).toBe('none')
      expect(blueprint?.gamificationStrategy.execution).toBe('none')
      expect(blueprint?.registry).toHaveLength(LOYALTY_SECTION_IDS.length)

      const direct = buildLoyaltyPlatformBlueprint({ sessionId: 'loy2' })
      expect(direct.version).toBe('7.2.0-loyalty-platform')
      expect(
        LoyaltyPlatformFoundation.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
