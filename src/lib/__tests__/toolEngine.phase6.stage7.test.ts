/**
 * Phase 6 Stage 7 — AI Tool Execution Engine architecture tests.
 * Contracts/blueprints only. No LLM / APIs / Runtime / tool dispatch.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_TOOL_ENGINE_FEATURE_ID,
  TOOL_ENGINE_ARCHITECTURE,
  TOOL_FUTURE_CAPABILITIES,
  TOOL_PIPELINE_STAGES,
  ToolExecutionEngine,
  ToolRegistry,
  assertToolEngineIsolation,
  buildToolEngineBlueprint,
  isBrainToolEngineEnabled,
  tryBuildToolEngineBlueprint,
} from '../orchestration/toolEngine'

describe('Phase 6 Stage 7 — AI Tool Execution Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.tool_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_TOOL_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.knowledge_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_TOOL_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainToolEngineEnabled()).toBe(false)
      expect(tryBuildToolEngineBlueprint({})).toBeNull()
      expect(TOOL_ENGINE_ARCHITECTURE.toolExecution).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoAmadeus).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoGoogleApis).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoMapsApis).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoWeatherApis).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoSupabase).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoRedis).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TOOL_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s7',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s7',
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
    it('exposes registry, future capabilities, and pipeline stages', () => {
      expect(assertToolEngineIsolation().architectureOnly).toBe(true)
      expect(ToolRegistry.list()).toHaveLength(TOOL_FUTURE_CAPABILITIES.length)
      expect(TOOL_FUTURE_CAPABILITIES).toEqual(
        expect.arrayContaining([
          'flight_search',
          'hotel_search',
          'activity_search',
          'visa_services',
          'weather',
          'maps',
          'currency',
          'calendar',
          'email',
          'whatsapp',
          'notifications',
          'payments',
          'booking_apis',
          'crm',
          'document_processing',
          'translation',
          'voice',
          'image',
        ]),
      )
      expect(TOOL_PIPELINE_STAGES).toContain('discover_tools')
      expect(TOOL_PIPELINE_STAGES).toContain('dispatch')
      expect(TOOL_PIPELINE_STAGES).toContain('check_circuit')
      expect(TOOL_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'tool_execution_engine',
          'tool_registry',
          'tool_router',
          'tool_dispatcher',
          'tool_circuit_breaker',
          'tool_audit_trail',
          'tool_execution_pipeline',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildToolEngineBlueprint({
        enabled: true,
        sessionId: 't-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.pipeline.execution).toBe('none')
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.router.execution).toBe('none')
      expect(blueprint?.dispatcher.execution).toBe('none')
      expect(blueprint?.toolContracts.every((c) => c.execution === 'none')).toBe(
        true,
      )
      expect(blueprint?.retryStrategy.maxAttemptsHint).toBe(0)
      expect(blueprint?.timeoutStrategy.timeoutMsHint).toBe(0)
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.queue.items).toHaveLength(0)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.futureCapabilities).toHaveLength(
        TOOL_FUTURE_CAPABILITIES.length,
      )

      const direct = buildToolEngineBlueprint({ sessionId: 't2' })
      expect(direct.version).toBe('6.7.0-tool-engine')
      expect(ToolExecutionEngine.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
