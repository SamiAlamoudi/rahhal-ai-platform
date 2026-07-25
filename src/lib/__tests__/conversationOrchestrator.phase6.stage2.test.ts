/**
 * Phase 6 Stage 2 — AI Conversation Orchestrator architecture tests.
 * Contracts only. No LLM / API / Runtime execution.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  CONVERSATION_ORCHESTRATOR_ARCHITECTURE,
  ConversationOrchestrator,
  ConversationRegistry,
  ORCHESTRATOR_MODULE_IDS,
  assertConversationOrchestratorIsolation,
  buildConversationOrchestrationBlueprint,
  isBrainConversationOrchestratorEnabled,
  tryBuildConversationOrchestrationBlueprint,
} from '../orchestration/conversationOrchestrator'

describe('Phase 6 Stage 2 — AI Conversation Orchestrator (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.conversation_orchestrator default OFF', () => {
      const def = getFeatureRegistry().get(
        BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID,
      )
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.integration_foundation'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID),
      ).toBe(false)
      expect(isBrainConversationOrchestratorEnabled()).toBe(false)
      expect(tryBuildConversationOrchestrationBlueprint({})).toBeNull()
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.llmExecution).toBe(false)
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.runtimeExecution).toBe(false)
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.wiredIntoOpenAi).toBe(false)
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.wiredIntoClaude).toBe(false)
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.wiredIntoGemini).toBe(false)
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.wiredIntoAmadeus).toBe(false)
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.wiredIntoDatabase).toBe(
        false,
      )
      expect(
        CONVERSATION_ORCHESTRATOR_ARCHITECTURE.distinctFromPhase3Flag,
      ).toBe('ai.conversation_orchestrator')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s2',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s2',
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
    it('exposes registry, modules, and architecture components', () => {
      expect(assertConversationOrchestratorIsolation().architectureOnly).toBe(
        true,
      )
      expect(ConversationRegistry.list().length).toBe(
        ORCHESTRATOR_MODULE_IDS.length,
      )
      expect(CONVERSATION_ORCHESTRATOR_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'intent_pipeline',
          'context_builder',
          'memory_reader',
          'memory_writer',
          'reasoning_pipeline',
          'response_pipeline',
          'clarification_engine',
          'confidence_engine',
          'conversation_state_machine',
          'conversation_analytics',
        ]),
      )
      expect(
        CONVERSATION_ORCHESTRATOR_ARCHITECTURE.coordinatedModules,
      ).toContain('integration_foundation')
      expect(
        CONVERSATION_ORCHESTRATOR_ARCHITECTURE.coordinatedModules,
      ).toContain('operations_center')
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildConversationOrchestrationBlueprint({
        enabled: true,
        sessionId: 's-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.presentationArchitectureOnly).toBe(true)
      expect(blueprint?.intent.execution).toBe('none')
      expect(blueprint?.reasoning.execution).toBe('none')
      expect(blueprint?.response.execution).toBe('none')
      expect(blueprint?.memoryWrite.persisted).toBe(false)
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.coordinatedModules.length).toBeGreaterThan(10)
      expect(blueprint?.events.length).toBeGreaterThan(0)
      expect(blueprint?.stateMachine.current).toBe('idle')

      const direct = buildConversationOrchestrationBlueprint({
        sessionId: 's2',
      })
      expect(direct.version).toBe('6.2.0-conversation-orchestrator')
      expect(ConversationOrchestrator.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
