/**
 * Phase 6 Stage 9 — AI Runtime Orchestrator architecture tests.
 * Contracts/blueprints only. No production runtime / AI / APIs / SDKs.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID,
  RUNTIME_ENGINE_REFS,
  RUNTIME_LIFECYCLE_ACTIONS,
  RUNTIME_ORCHESTRATOR_ARCHITECTURE,
  RUNTIME_PIPELINE_STAGES,
  ExecutionRegistry,
  RuntimeOrchestrator,
  assertRuntimeOrchestratorIsolation,
  buildRuntimeOrchestratorBlueprint,
  isBrainRuntimeOrchestratorEnabled,
  tryBuildRuntimeOrchestratorBlueprint,
} from '../orchestration/runtimeOrchestrator'

describe('Phase 6 Stage 9 — AI Runtime Orchestrator (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.runtime_orchestrator default OFF', () => {
      const def = getFeatureRegistry().get(
        BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID,
      )
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.llm_adapter'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_RUNTIME_ORCHESTRATOR_FEATURE_ID),
      ).toBe(false)
      expect(isBrainRuntimeOrchestratorEnabled()).toBe(false)
      expect(tryBuildRuntimeOrchestratorBlueprint({})).toBeNull()
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.productionRuntime).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.aiCalls).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.toolExecution).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoOpenAi).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoClaude).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoGemini).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.httpRequests).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.streamingImplemented).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoSupabase).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoRedis).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s9',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s9',
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
    it('exposes engines, lifecycle, and pipeline stages', () => {
      expect(assertRuntimeOrchestratorIsolation().architectureOnly).toBe(true)
      expect(ExecutionRegistry.list()).toHaveLength(RUNTIME_ENGINE_REFS.length)
      expect(RUNTIME_ENGINE_REFS).toEqual(
        expect.arrayContaining([
          'conversation_orchestrator',
          'planning_engine',
          'decision_engine',
          'memory_engine',
          'knowledge_engine',
          'tool_engine',
          'llm_adapter',
        ]),
      )
      expect(RUNTIME_LIFECYCLE_ACTIONS).toEqual(
        expect.arrayContaining([
          'start',
          'pause',
          'resume',
          'cancel',
          'rollback',
          'recovery',
          'completion',
        ]),
      )
      expect(RUNTIME_PIPELINE_STAGES).toContain('coordinate_conversation')
      expect(RUNTIME_PIPELINE_STAGES).toContain('coordinate_llm_adapter')
      expect(RUNTIME_PIPELINE_STAGES).toContain('complete_or_recover')
      expect(RUNTIME_ORCHESTRATOR_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'runtime_orchestrator',
          'execution_pipeline',
          'execution_lifecycle',
          'execution_dependency_graph',
          'execution_audit_trail',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildRuntimeOrchestratorBlueprint({
        enabled: true,
        sessionId: 'r-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.orchestrator.execution).toBe('none')
      expect(blueprint?.pipeline.execution).toBe('none')
      expect(blueprint?.session.opened).toBe(false)
      expect(blueprint?.lifecycle.actions).toHaveLength(
        RUNTIME_LIFECYCLE_ACTIONS.length,
      )
      expect(blueprint?.guards.denyByDefault).toBe(true)
      expect(blueprint?.queue.items).toHaveLength(0)
      expect(blueprint?.retryStrategy.maxAttemptsHint).toBe(0)
      expect(blueprint?.timeoutStrategy.timeoutMsHint).toBe(0)
      expect(blueprint?.metrics.recorded).toBe(false)
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.logging.wired).toBe(false)
      expect(blueprint?.monitoring.wired).toBe(false)
      expect(blueprint?.traceModel.exported).toBe(false)
      expect(blueprint?.dependencyGraph.nodes).toHaveLength(
        RUNTIME_ENGINE_REFS.length,
      )
      expect(blueprint?.dependencyGraph.edges.length).toBeGreaterThan(0)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.contracts.every((c) => c.execution === 'none')).toBe(
        true,
      )

      const direct = buildRuntimeOrchestratorBlueprint({ sessionId: 'r2' })
      expect(direct.version).toBe('6.9.0-runtime-orchestrator')
      expect(
        RuntimeOrchestrator.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
