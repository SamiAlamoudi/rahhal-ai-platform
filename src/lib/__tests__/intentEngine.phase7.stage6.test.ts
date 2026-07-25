/**
 * Phase 7 Stage 6 — Intent Recognition Engine architecture tests.
 * Contracts/blueprints only. No LLM / Runtime / classification.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_INTENT_ENGINE_FEATURE_ID,
  INTENT_ENGINE_ARCHITECTURE,
  INTENT_KINDS,
  INTENT_PIPELINE_STAGES,
  INTENT_SECTION_IDS,
  IntentEngine,
  IntentRegistry,
  assertIntentEngineIsolation,
  buildIntentEngineBlueprint,
  isBrainIntentEngineEnabled,
  tryBuildIntentEngineBlueprint,
} from '../orchestration/intentEngine'

describe('Phase 7 Stage 6 — Intent Recognition Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.intent_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_INTENT_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.context_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_INTENT_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainIntentEngineEnabled()).toBe(false)
      expect(tryBuildIntentEngineBlueprint({})).toBeNull()
      expect(INTENT_ENGINE_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(INTENT_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(INTENT_ENGINE_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(INTENT_ENGINE_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(INTENT_ENGINE_ARCHITECTURE.httpRequests).toBe(false)
      expect(INTENT_ENGINE_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(INTENT_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
      expect(
        INTENT_ENGINE_ARCHITECTURE.distinctFromSprint19BrainIntent,
      ).toBe(true)
      expect(getFeatureRegistry().get('brain.intent')?.id).toBe('brain.intent')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s6',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s6',
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
    it('exposes intent kinds, pipeline, and components', () => {
      expect(assertIntentEngineIsolation().architectureOnly).toBe(true)
      expect(IntentRegistry.listKinds()).toHaveLength(INTENT_KINDS.length)
      expect(IntentRegistry.listSections()).toHaveLength(
        INTENT_SECTION_IDS.length,
      )
      expect(INTENT_KINDS).toEqual(
        expect.arrayContaining([
          'book_flight',
          'book_hotel',
          'plan_trip',
          'modify_trip',
          'cancel_trip',
          'compare_destinations',
          'visa_inquiry',
          'emergency_support',
          'multi_intent',
          'intent_switching',
        ]),
      )
      expect(INTENT_PIPELINE_STAGES).toContain('classify_candidates')
      expect(INTENT_PIPELINE_STAGES).toContain('detect_multi_intent')
      expect(INTENT_PIPELINE_STAGES).toContain('model_transition')
      expect(INTENT_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'intent_engine',
          'intent_classifier',
          'intent_transition_model',
          'multi_intent',
          'traveler_intent_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildIntentEngineBlueprint({
        enabled: true,
        sessionId: 'int-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.classifier.execution).toBe('none')
      expect(blueprint?.snapshot.primaryIntent).toBeNull()
      expect(blueprint?.multiIntentResult.primaryHint).toBeNull()
      expect(blueprint?.history.persisted).toBe(false)
      expect(blueprint?.intentConfidence.bandHint).toBe('medium')
      expect(blueprint?.intentValidation.valid).toBe(true)
      expect(blueprint?.registry.entries).toHaveLength(INTENT_KINDS.length)
      expect(blueprint?.bookingIntent.intentKinds).toContain('book_flight')
      expect(blueprint?.supportIntent.intentKinds).toContain(
        'emergency_support',
      )
      expect(blueprint?.sectionRegistry).toHaveLength(INTENT_SECTION_IDS.length)

      const direct = buildIntentEngineBlueprint({ sessionId: 'i2' })
      expect(direct.version).toBe('7.6.0-intent-engine')
      expect(IntentEngine.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
