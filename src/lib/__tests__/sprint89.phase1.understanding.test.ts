/**
 * Sprint 89 Phase 1 — Understanding core unit + contract tests.
 * Flags OFF by default. No search / provider / booking / payment.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { emptyMemory } from '../agent/types'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_PREVIEW_FEATURE_ID,
  PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
  UNDERSTANDING_CONTRACT_VERSION,
  UNDERSTANDING_MEMORY_MANAGER_VERSION,
  advanceUnderstandingState,
  createIntentExtractor,
  createProvenancedEntityExtractor,
  createReferenceResolver,
  createUnderstandingMemoryManager,
  mapBrainStateToPreviewStage,
  mapLifecycleToBrainState,
  routeBrainPreviewTurn,
  understandTurn,
} from '../brain/v1'
import type { ChatMessage } from '../chat/chatTypes'
import { RECOVERY_FROZEN_OFF_FLAGS, RECOVERY_TURN_OWNER } from '../recovery/freeze'

function msg(
  role: 'user' | 'assistant',
  content: string,
  conversationId = 's89-p1',
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

describe('Sprint 89 Phase 1 — Understanding core', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('flags / freeze / contracts', () => {
    it('keeps Brain flags OFF and planTurn as sole turn owner', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
      expect(RECOVERY_FROZEN_OFF_FLAGS).toContain('ai.brain.v1')
      expect(RECOVERY_TURN_OWNER).toBe('travelAgentService.planTurn')
      expect(getFeatureRegistry().list().map((f) => f.id)).not.toContain('ai.tie.v1')
      expect(UNDERSTANDING_CONTRACT_VERSION).toMatch(/sprint89-phase1/)
      expect(UNDERSTANDING_MEMORY_MANAGER_VERSION).toMatch(/sprint89-phase1/)
    })

    it('default-OFF planTurn does not attach brainV1Preview', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: false })
      const result = await service.planTurn({
        conversationId: 's89-p1-off',
        messages: [msg('user', 'أريد رحلة إلى المغرب', 's89-p1-off')],
      })
      expect(result.meta.brainV1Preview).toBeUndefined()
    })
  })

  describe('IntentExtractor', () => {
    const intents = createIntentExtractor()

    it('extracts consultant plan_trip for Morocco request', () => {
      const r = intents.extract('أريد رحلة إلى المغرب')
      expect(r.contractVersion).toBe(UNDERSTANDING_CONTRACT_VERSION)
      expect(r.primaryIntent).toBe('plan_trip')
      expect(r.isCorrection).toBe(false)
      expect(r.confidence.level).not.toBe('unknown')
      expect(r.legacyIntent).not.toBe('unknown')
    })

    it('flags corrections and aborts', () => {
      expect(intents.extract('صرت أبغى تركيا بدل المغرب').isCorrection).toBe(true)
      expect(intents.extract('صرت أبغى تركيا بدل المغرب').primaryIntent).toBe('correct')
      expect(intents.extract('ألغِ التخطيط').primaryIntent).toBe('abort')
    })

    it('detects compare / explore / small talk', () => {
      expect(intents.extract('المغرب ولا تركيا؟').primaryIntent).toBe('compare')
      expect(intents.extract('ما عندي وجهة محددة، اقترح لي').primaryIntent).toBe(
        'explore_destination',
      )
      expect(intents.extract('مرحبا').primaryIntent).toBe('small_talk')
    })
  })

  describe('EntityExtractor provenance', () => {
    const entities = createProvenancedEntityExtractor()

    it('tags destination as user_provided confirmed with provenance', () => {
      const r = entities.extractWithProvenance('أريد رحلة إلى المغرب')
      expect(r.entities.destination).toBe('Morocco')
      const dest = r.facts.find((f) => f.field === 'destination')
      expect(dest?.kind).toBe('user_provided')
      expect(dest?.confidence.level).toBe('confirmed')
      expect(r.revisedFields).toContain('destination')
      // Never force booking-only fields
      expect(r.facts.some((f) => /passport|payment/i.test(f.field))).toBe(false)
    })

    it('supports destination correction Turkey over Morocco', () => {
      const prior = entities.extract('أريد رحلة إلى المغرب')
      const next = entities.extractWithProvenance('صرت أبغى تركيا بدل المغرب', prior)
      expect(next.entities.destination).toBe('Turkey')
      expect(next.revisedFields).toContain('destination')
    })

    it('never labels extracted facts as assumption+confirmed', () => {
      const r = entities.extractWithProvenance('flight to Dubai adults 2 budget 5000 SAR')
      for (const fact of r.facts) {
        expect(!(fact.kind === 'assumption' && fact.confidence.level === 'confirmed')).toBe(true)
      }
    })
  })

  describe('ReferenceResolver', () => {
    const refs = createReferenceResolver()

    it('resolves هناك to memory destination', () => {
      const r = refs.resolve({ text: 'خلينا نروح هناك', destination: 'Morocco' })
      expect(r.resolved.some((x) => x.resolvesTo === 'Morocco')).toBe(true)
      expect(r.ambiguous).toHaveLength(0)
    })

    it('returns ambiguous when same hotel has no context', () => {
      const r = refs.resolve({ text: 'نفس الفندق' })
      expect(r.ambiguous.length).toBeGreaterThan(0)
      expect(r.resolved).toHaveLength(0)
    })

    it('does not invent destinations', () => {
      const r = refs.resolve({ text: 'there please' })
      expect(r.resolved).toHaveLength(0)
      expect(r.ambiguous.some((a) => a.field === 'trip.destination')).toBe(true)
    })
  })

  describe('ConversationState', () => {
    it('maps lifecycle and brain states without leaking search', () => {
      expect(mapLifecycleToBrainState('value_first')).toBe('Advising')
      expect(mapBrainStateToPreviewStage('Understanding')).toBe('exploring')
      expect(mapBrainStateToPreviewStage('Searching')).toBe('searching')
      const advanced = advanceUnderstandingState(null, {
        conversationId: 'c1',
        locale: 'ar',
        consultantIntent: 'plan_trip',
        hasAmbiguousReferences: false,
        hasEntityRevisions: true,
      })
      expect(advanced.brainState).toBe('Understanding')
      expect(advanced.previewStage).not.toBe('searching')
    })
  })

  describe('MemoryManager', () => {
    it('applies entity facts with provenance and rejects assumption-as-confirmed', () => {
      const mm = createUnderstandingMemoryManager()
      const memory = emptyMemory('ar')
      const applied = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Morocco',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 0.95 },
          evidence: 'المغرب',
        },
        {
          field: 'cabinClass',
          value: 'economy',
          kind: 'assumption',
          confidence: { level: 'confirmed', score: 1 },
          evidence: null,
        },
      ])
      expect(applied.memory.requirements.destination).toBe('Morocco')
      expect(applied.applied.some((a) => a.field === 'destination')).toBe(true)
      expect(applied.rejected.some((r) => r.field === 'cabinClass')).toBe(true)
      expect(applied.provenance.destination?.source).toBe('user_stated')
    })

    it('invalidates prior trip selection on destination change', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = {
        ...memory,
        requirements: { ...memory.requirements, destination: 'Morocco' },
        selectedBookingOption: {
          id: 'opt_1',
          kind: 'flight',
          label: 'demo',
          price: 100,
          currency: 'SAR',
        },
      }
      const next = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Turkey',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Turkey',
        },
      ])
      expect(next.memory.requirements.destination).toBe('Turkey')
      expect(next.memory.selectedBookingOption).toBeNull()
    })
  })

  describe('understandTurn pipeline', () => {
    it('runs Intent → Entity → Reference → State for Morocco', () => {
      const result = understandTurn({
        text: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 'u1',
      })
      expect(result.contractVersion).toBe(UNDERSTANDING_CONTRACT_VERSION)
      expect(result.intent.primaryIntent).toBe('plan_trip')
      expect(result.entities.entities.destination).toBe('Morocco')
      expect(result.summary.brainState).toBe('Understanding')
      expect(result.memoryProposals.some((p) => p.field === 'destination')).toBe(true)
    })

    it('resolves reference using memory hints', () => {
      const result = understandTurn({
        text: 'خلينا نروح هناك',
        locale: 'ar',
        conversationId: 'u2',
        memoryHints: { destination: 'Morocco' },
      })
      expect(result.references.resolved.length).toBeGreaterThan(0)
      expect(result.entities.entities.destination).toBe('Morocco')
    })
  })

  describe('BrainRouter Phase 1 enrichment', () => {
    it('populates understanding meta and keeps toolBatch null / early_return_locked', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 's89-p1-router',
        messages: [msg('user', 'أريد رحلة إلى المغرب', 's89-p1-router')],
        memory: emptyMemory('ar'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(decision.path).toBe('brain')
      if (decision.path !== 'brain') return
      expect(decision.result.toolBatch).toBeNull()
      const preview = decision.result.meta.brainV1Preview
      expect(preview?.contractsVersion).toBe(PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION)
      expect(preview?.searchHandoffHint?.kind).toBe('early_return_locked')
      expect(preview?.understanding?.consultantIntent).toBe('plan_trip')
      expect(preview?.understanding?.entityFields).toContain('destination')
      expect(decision.result.memory.requirements.destination).toBe('Morocco')
      expect(preview?.memoryProvenanceFields).toContain('destination')
    })

    it('preview OFF still returns current path', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 's89-p1-off',
        messages: [msg('user', 'أريد رحلة إلى المغرب', 's89-p1-off')],
        memory: emptyMemory('ar'),
        enabled: false,
      })
      expect(decision.path).toBe('current')
    })
  })
})
