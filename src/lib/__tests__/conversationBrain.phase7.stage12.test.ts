/**
 * Phase 7 Stage 12 — AI Conversation Brain Orchestrator architecture tests.
 * Contracts/blueprints only. No engine invocation / LLM / providers / UI.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_CONVERSATION_BRAIN_FEATURE_ID,
  CONVERSATION_BRAIN_ARCHITECTURE,
  CONVERSATION_BRAIN_ENGINE_HINTS,
  CONVERSATION_BRAIN_PIPELINE_STAGES,
  CONVERSATION_BRAIN_SECTION_IDS,
  ConversationBrainOrchestrator,
  assertConversationBrainIsolation,
  buildConversationBrainBlueprint,
  isBrainConversationBrainEnabled,
  tryBuildConversationBrainBlueprint,
} from '../orchestration/conversationBrain'

describe('Phase 7 Stage 12 — AI Conversation Brain Orchestrator (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.conversation_brain default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_CONVERSATION_BRAIN_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.booking_orchestrator'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_CONVERSATION_BRAIN_FEATURE_ID),
      ).toBe(false)
      expect(isBrainConversationBrainEnabled()).toBe(false)
      expect(tryBuildConversationBrainBlueprint({})).toBeNull()
      expect(CONVERSATION_BRAIN_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.httpRequests).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.wiredIntoProviderApis).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.bookingExecuted).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.wiredIntoUi).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.enginesInvoked).toBe(false)
      expect(CONVERSATION_BRAIN_ARCHITECTURE.businessLogicExecuted).toBe(false)
      expect(
        CONVERSATION_BRAIN_ARCHITECTURE.distinctFromAgentConversationBrain,
      ).toBe(true)
      expect(
        CONVERSATION_BRAIN_ARCHITECTURE.distinctFromBrainConversationOrchestrator,
      ).toBe(true)
      expect(
        CONVERSATION_BRAIN_ARCHITECTURE.distinctFromAiConversationOrchestrator,
      ).toBe(true)
      expect(getFeatureRegistry().get('brain.conversation_orchestrator')?.id).toBe(
        'brain.conversation_orchestrator',
      )
      expect(getFeatureRegistry().get('brain.booking_orchestrator')?.id).toBe(
        'brain.booking_orchestrator',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s12',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s12',
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
    it('exposes coordinated pipeline and engine hints', () => {
      expect(assertConversationBrainIsolation().architectureOnly).toBe(true)
      expect(ConversationBrainOrchestrator.listRegistry()).toHaveLength(
        CONVERSATION_BRAIN_SECTION_IDS.length,
      )
      expect(CONVERSATION_BRAIN_PIPELINE_STAGES).toEqual([
        'receive_user_message',
        'personalization',
        'preference_extraction',
        'traveler_context',
        'intent_recognition',
        'travel_planning',
        'travel_search',
        'recommendation',
        'offer_decision',
        'booking_draft',
        'emit_conversation_brain_result',
      ])
      expect(CONVERSATION_BRAIN_ENGINE_HINTS).toEqual(
        expect.arrayContaining([
          'personalization_engine',
          'intent_recognition_engine',
          'travel_search_orchestrator',
          'travel_recommendation_engine',
          'offer_decision_engine',
          'booking_orchestrator',
        ]),
      )
      expect(CONVERSATION_BRAIN_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'conversation_brain_engine',
          'conversation_brain_pipeline',
          'conversation_brain_result_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildConversationBrainBlueprint({
        enabled: true,
        sessionId: 'brain-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.engine.books).toBe(false)
      expect(blueprint?.engine.providerCalled).toBe(false)
      expect(blueprint?.engine.llmInvoked).toBe(false)
      expect(blueprint?.engine.httpRequests).toBe(false)
      expect(blueprint?.revision.persisted).toBe(false)
      expect(blueprint?.conversationBrainResult.architectureOnly).toBe(true)
      expect(blueprint?.conversationBrainResult.kind).toBe(
        'phase7_conversation_brain_result',
      )
      expect(blueprint?.conversationBrainValidation.valid).toBe(true)
      expect(blueprint?.conversationBrainConfidence.bandHint).toBe('medium')
      expect(blueprint?.conversationBrainState.currentStepHint).toBeNull()
      expect(blueprint?.coordinatedEngineHints).toHaveLength(
        CONVERSATION_BRAIN_ENGINE_HINTS.length,
      )
      expect(blueprint?.registry).toHaveLength(
        CONVERSATION_BRAIN_SECTION_IDS.length,
      )

      const direct = buildConversationBrainBlueprint({ sessionId: 's2' })
      expect(direct.version).toBe('7.12.0-conversation-brain')
      expect(
        ConversationBrainOrchestrator.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
