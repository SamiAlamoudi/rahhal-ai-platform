/**
 * Phase 6 Stage 4 — AI Decision Engine architecture tests.
 * Contracts only. No decision execution / LLM / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_DECISION_ENGINE_FEATURE_ID,
  DECISION_ENGINE_ARCHITECTURE,
  DECISION_PIPELINE_STAGES,
  DecisionEngine,
  DecisionRegistry,
  assertDecisionEngineIsolation,
  buildDecisionEngineBlueprint,
  isBrainDecisionEngineEnabled,
  tryBuildDecisionEngineBlueprint,
} from '../orchestration/decisionEngine'

describe('Phase 6 Stage 4 — AI Decision Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.decision_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_DECISION_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.planning_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_DECISION_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainDecisionEngineEnabled()).toBe(false)
      expect(tryBuildDecisionEngineBlueprint({})).toBeNull()
      expect(DECISION_ENGINE_ARCHITECTURE.decisionExecution).toBe(false)
      expect(DECISION_ENGINE_ARCHITECTURE.llmImplementation).toBe(false)
      expect(DECISION_ENGINE_ARCHITECTURE.runtimeLogic).toBe(false)
      expect(DECISION_ENGINE_ARCHITECTURE.wiredIntoOpenAi).toBe(false)
      expect(DECISION_ENGINE_ARCHITECTURE.wiredIntoAmadeus).toBe(false)
      expect(DECISION_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(DECISION_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s4',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s4',
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
    it('exposes registry, pipeline stages, and architecture components', () => {
      expect(assertDecisionEngineIsolation().architectureOnly).toBe(true)
      expect(DecisionRegistry.list().length).toBeGreaterThan(8)
      expect(DECISION_PIPELINE_STAGES).toContain('score_alternatives')
      expect(DECISION_PIPELINE_STAGES).toContain('build_recommendation')
      expect(DECISION_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'scoring_engine',
          'ranking_engine',
          'explainability_layer',
          'recommendation_builder',
          'decision_audit_trail',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildDecisionEngineBlueprint({
        enabled: true,
        sessionId: 'd-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.pipeline.execution).toBe('none')
      expect(blueprint?.scoringEngine.execution).toBe('none')
      expect(blueprint?.rankingEngine.execution).toBe('none')
      expect(blueprint?.recommendationBuilder.execution).toBe('none')
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.confidenceCalculator.band).toBe('medium')

      const direct = buildDecisionEngineBlueprint({ sessionId: 'd2' })
      expect(direct.version).toBe('6.4.0-decision-engine')
      expect(DecisionEngine.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
