/**
 * Phase 6 Stage 6 — AI Knowledge Engine architecture tests.
 * Contracts/blueprints only. No LLM / APIs / DB / vector search.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID,
  KNOWLEDGE_COVERAGE_DOMAINS,
  KNOWLEDGE_ENGINE_ARCHITECTURE,
  KNOWLEDGE_PIPELINE_STAGES,
  KnowledgeEngine,
  KnowledgeRegistry,
  assertKnowledgeEngineIsolation,
  buildKnowledgeEngineBlueprint,
  isBrainKnowledgeEngineEnabled,
  tryBuildKnowledgeEngineBlueprint,
} from '../orchestration/knowledgeEngine'

describe('Phase 6 Stage 6 — AI Knowledge Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.knowledge_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.memory_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainKnowledgeEngineEnabled()).toBe(false)
      expect(tryBuildKnowledgeEngineBlueprint({})).toBeNull()
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.knowledgeImplementation).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoAmadeus).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoGoogleMaps).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoWeatherApis).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoVectorDb).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoSearchBackend).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s6',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s6',
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
    it('exposes registry, coverage domains, and pipeline stages', () => {
      expect(assertKnowledgeEngineIsolation().architectureOnly).toBe(true)
      expect(KnowledgeRegistry.list()).toHaveLength(
        KNOWLEDGE_COVERAGE_DOMAINS.length,
      )
      expect(KNOWLEDGE_COVERAGE_DOMAINS).toEqual(
        expect.arrayContaining([
          'destination',
          'visa',
          'airline',
          'hotel',
          'weather_reference',
          'policy_reference',
        ]),
      )
      expect(KNOWLEDGE_PIPELINE_STAGES).toContain('retrieve')
      expect(KNOWLEDGE_PIPELINE_STAGES).toContain('attach_provenance')
      expect(KNOWLEDGE_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'knowledge_providers',
          'knowledge_graph',
          'knowledge_retrieval',
          'knowledge_freshness',
          'knowledge_audit_trail',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildKnowledgeEngineBlueprint({
        enabled: true,
        sessionId: 'k-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.pipeline.execution).toBe('none')
      expect(blueprint?.providers.every((p) => p.execution === 'none')).toBe(
        true,
      )
      expect(blueprint?.graph.execution).toBe('none')
      expect(blueprint?.retrieval.execution).toBe('none')
      expect(blueprint?.cache.backed).toBe(false)
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.coverageDomains).toHaveLength(
        KNOWLEDGE_COVERAGE_DOMAINS.length,
      )
      expect(blueprint?.confidence.band).toBe('medium')

      const direct = buildKnowledgeEngineBlueprint({ sessionId: 'k2' })
      expect(direct.version).toBe('6.6.0-knowledge-engine')
      expect(KnowledgeEngine.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
