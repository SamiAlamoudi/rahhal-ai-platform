/**
 * Sprint 88 Task 2 — Preview / Domain / Ranking / NormalizedOffer contracts.
 * Interfaces only — no Search Handoff impl, no provider execute, flags OFF.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_PREVIEW_FEATURE_ID,
  DEFAULT_RANKING_CONFIG,
  DEFAULT_RANKING_WEIGHTS,
  DOMAIN_INTELLIGENCE_CONTRACT_VERSION,
  EXTENDED_RANKING_WEIGHT_KEYS,
  PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
  RANKING_CONFIG_CONTRACT_VERSION,
  blockedInsufficientInformationHint,
  createNormalizedOfferSkeleton,
  domainIntelligenceNotImplemented,
  earlyReturnLockedHandoffHint,
  isNormalizedOfferStale,
  mergeRankingConfig,
  routeBrainPreviewTurn,
  skippedDomainResult,
  sumCoreRankingDefaults,
} from '../brain/v1'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { RECOVERY_TURN_OWNER } from '../recovery/freeze'

function msg(
  role: 'user' | 'assistant',
  content: string,
  conversationId = 's88-t2',
): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

describe('Sprint 88 Task 2 — Preview + domain contracts', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('flags / freeze unchanged', () => {
    it('keeps Brain flags OFF and recovery owner intact', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
      expect(RECOVERY_TURN_OWNER).toBe('travelAgentService.planTurn')
      expect(getFeatureRegistry().list().map((f) => f.id)).not.toContain('ai.tie.v1')
    })
  })

  describe('Preview Orchestrator contracts', () => {
    it('exports contract version and early-return / clarify hints', () => {
      expect(PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION).toMatch(/sprint88-preview/)
      const locked = earlyReturnLockedHandoffHint()
      expect(locked.kind).toBe('early_return_locked')
      const blocked = blockedInsufficientInformationHint(['dates'])
      expect(blocked.kind).toBe('blocked_insufficient_information')
      if (blocked.kind !== 'blocked_insufficient_information') return
      expect(blocked.mustNotInvokeSearchOrGateway).toBe(true)
      expect(blocked.missingFields).toEqual(['dates'])
    })

    it('BrainRouter success path: toolBatch null; Phase 1 may populate contract meta (still no search)', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 's88-t2',
        messages: [msg('user', 'I want to travel to Morocco.')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(decision.path).toBe('brain')
      if (decision.path !== 'brain') return
      expect(decision.result.toolBatch).toBeNull()
      // Sprint 89 Phase 1 populates Preview Orchestrator meta; Search Handoff stays locked.
      expect(decision.result.meta.brainV1Preview?.contractsVersion).toBe(
        PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
      )
      expect(decision.result.meta.brainV1Preview?.searchHandoffHint?.kind).toBe(
        'early_return_locked',
      )
    })
  })

  describe('Ranking config', () => {
    it('defaults match RecommendationEngine and sum to 1', () => {
      expect(RANKING_CONFIG_CONTRACT_VERSION).toMatch(/ranking/)
      expect(DEFAULT_RANKING_CONFIG).toEqual(DEFAULT_RANKING_WEIGHTS)
      expect(sumCoreRankingDefaults()).toBeCloseTo(1, 5)
      expect(EXTENDED_RANKING_WEIGHT_KEYS).toContain('valueForMoney')
      expect(EXTENDED_RANKING_WEIGHT_KEYS).toContain('providerConfidence')
      expect(EXTENDED_RANKING_WEIGHT_KEYS).not.toContain('morocco' as never)
    })

    it('mergeRankingConfig applies overrides without mutating defaults', () => {
      const merged = mergeRankingConfig({ price: 0.4, valueForMoney: 0.1 })
      expect(merged.price).toBe(0.4)
      expect(merged.valueForMoney).toBe(0.1)
      expect(DEFAULT_RANKING_CONFIG.price).toBe(DEFAULT_RANKING_WEIGHTS.price)
    })
  })

  describe('NormalizedOffer', () => {
    it('skeleton fills unknown baggage/fees and supports stale detection', () => {
      const offer = createNormalizedOfferSkeleton({
        id: 'o1',
        kind: 'flight',
        title: 'Test',
        money: { amount: 100, currency: 'SAR' },
        fetchedAt: new Date(0).toISOString(),
        staleAfterMs: 1000,
      })
      expect(offer.baggage.status).toBe('unknown')
      expect(offer.money.taxesAndFeesUnknown).toBe(true)
      expect(offer.cancellation.status).toBe('unknown')
      expect(offer.provenance.providerId).toBe('unknown')
      expect(isNormalizedOfferStale(offer, 10_000)).toBe(true)
      expect(isNormalizedOfferStale(offer, 500)).toBe(false)
    })
  })

  describe('DomainIntelligence', () => {
    it('exposes contract version and skipped helper; execute not implemented', () => {
      expect(DOMAIN_INTELLIGENCE_CONTRACT_VERSION).toMatch(/domain-intelligence/)
      const skipped = skippedDomainResult('flight', 'contracts_only')
      expect(skipped.status).toBe('skipped')
      expect(skipped.offers).toEqual([])
      expect(skipped.telemetry.domain).toBe('flight')
      expect(() => domainIntelligenceNotImplemented('hotel')).toThrow(/not implemented/i)
    })
  })

  describe('default-OFF behavior unchanged', () => {
    it('planTurn with preview OFF has no brain meta', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: false })
      const result = await service.planTurn({
        conversationId: 's88-t2-off',
        messages: [msg('user', 'I want to travel to Morocco.', 's88-t2-off')],
      })
      expect(result.meta.brainV1Preview).toBeUndefined()
      expect(result.reply.length).toBeGreaterThan(0)
    })
  })
})
