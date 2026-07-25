/**
 * Phase 6 Stage 3 — AI Planning Engine architecture tests.
 * Contracts only. No planning execution / LLM / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_PLANNING_ENGINE_FEATURE_ID,
  PLANNING_ENGINE_ARCHITECTURE,
  PLANNING_PIPELINE_STAGES,
  PlanningEngine,
  PlanningRegistry,
  assertPlanningEngineIsolation,
  buildPlanningEngineBlueprint,
  isBrainPlanningEngineEnabled,
  tryBuildPlanningEngineBlueprint,
} from '../orchestration/planningEngine'

describe('Phase 6 Stage 3 — AI Planning Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.planning_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_PLANNING_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.conversation_orchestrator'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_PLANNING_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainPlanningEngineEnabled()).toBe(false)
      expect(tryBuildPlanningEngineBlueprint({})).toBeNull()
      expect(PLANNING_ENGINE_ARCHITECTURE.planningExecution).toBe(false)
      expect(PLANNING_ENGINE_ARCHITECTURE.aiReasoning).toBe(false)
      expect(PLANNING_ENGINE_ARCHITECTURE.llmImplementation).toBe(false)
      expect(PLANNING_ENGINE_ARCHITECTURE.wiredIntoOpenAi).toBe(false)
      expect(PLANNING_ENGINE_ARCHITECTURE.wiredIntoAmadeus).toBe(false)
      expect(PLANNING_ENGINE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(PLANNING_ENGINE_ARCHITECTURE.businessLogic).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p6s3',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p6s3',
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
      expect(assertPlanningEngineIsolation().architectureOnly).toBe(true)
      expect(PlanningRegistry.list().length).toBeGreaterThan(10)
      expect(PLANNING_PIPELINE_STAGES).toContain('build_itinerary')
      expect(PLANNING_PIPELINE_STAGES).toContain('score_confidence')
      expect(PLANNING_ENGINE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'trip_planner',
          'itinerary_generator',
          'budget_planner',
          'risk_analyzer',
          'planning_state_machine',
          'planning_confidence_model',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildPlanningEngineBlueprint({
        enabled: true,
        sessionId: 'p-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.pipeline.execution).toBe('none')
      expect(blueprint?.tripPlanner.execution).toBe('none')
      expect(blueprint?.itineraryGenerator.execution).toBe('none')
      expect(blueprint?.analytics.exported).toBe(false)
      expect(blueprint?.stateMachine.current).toBe('idle')
      expect(blueprint?.confidence.band).toBe('medium')
      expect(blueprint?.registry.length).toBeGreaterThan(0)

      const direct = buildPlanningEngineBlueprint({ sessionId: 'p2' })
      expect(direct.version).toBe('6.3.0-planning-engine')
      expect(PlanningEngine.tryBuildBlueprint({ enabled: false })).toBeNull()
    })
  })
})
