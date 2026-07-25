/**
 * Phase 6 Stage 5 — AI Memory Engine architecture tests.
 * Contracts/blueprints only. No embeddings / storage / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_MEMORY_ENGINE_FEATURE_ID,
  MEMORY_ENGINE_ARCHITECTURE,
  MEMORY_PIPELINE_STAGES,
  MEMORY_STORE_KINDS,
  MemoryEngine,
  MemoryRegistry,
  assertMemoryEngineIsolation,
  buildMemoryEngineBlueprint,
  isBrainMemoryEngineEnabled,
  tryBuildMemoryEngineBlueprint,
} from '../orchestration/memoryEngine'

describe('Phase 6 Stage 5 — AI Memory Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.memory_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_MEMORY_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.decision_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_MEMORY_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainMemoryEngineEnabled()).toBe(false)
      expect(tryBuildMemoryEngineBlueprint({})).toBeNull()
      expect(MEMORY_ENGINE_ARCHITECTURE.memoryImplementation).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoEmbeddings).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoVectorDatabase).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoSupabase).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoRedis).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(MEMORY_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s5',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s5',
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
    it('exposes registry, stores, pipeline, and architecture components', () => {
      expect(assertMemoryEngineIsolation().architectureOnly).toBe(true)
      expect(MemoryRegistry.list()).toHaveLength(MEMORY_STORE_KINDS.length)
      expect(MEMORY_PIPELINE_STAGES).toContain('rank_memories')
      expect(MEMORY_PIPELINE_STAGES).toContain('apply_retention')
      expect(MEMORY_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'conversation_memory',
          'memory_retrieval_strategy',
          'memory_merge_strategy',
          'memory_retention_policy',
          'memory_audit_trail',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildMemoryEngineBlueprint({
        enabled: true,
        sessionId: 'm-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.pipeline.execution).toBe('none')
      expect(blueprint?.storeContracts.every((s) => s.persisted === false)).toBe(
        true,
      )
      expect(blueprint?.conversationMemory.execution).toBe('none')
      expect(blueprint?.retrievalStrategy.execution).toBe('none')
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.confidence.band).toBe('medium')

      const direct = buildMemoryEngineBlueprint({ sessionId: 'm2' })
      expect(direct.version).toBe('6.5.0-memory-engine')
      expect(MemoryEngine.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
