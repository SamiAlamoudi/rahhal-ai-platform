/**
 * Phase 7 Stage 7 — AI Travel Planning Engine architecture tests.
 * Contracts/blueprints only. No booking / pricing / LLM / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_TRAVEL_PLANNING_FEATURE_ID,
  TRAVEL_PLANNING_ARCHITECTURE,
  TRAVEL_PLANNING_INPUT_HINTS,
  TRAVEL_PLANNING_PIPELINE_STAGES,
  TRAVEL_PLANNING_SECTION_IDS,
  TravelPlanningEngine,
  TravelPlanningRegistry,
  assertTravelPlanningIsolation,
  buildTravelPlanningBlueprint,
  isBrainTravelPlanningEnabled,
  tryBuildTravelPlanningBlueprint,
} from '../orchestration/travelPlanningEngine'

describe('Phase 7 Stage 7 — AI Travel Planning Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.travel_planning default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_TRAVEL_PLANNING_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.intent_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_TRAVEL_PLANNING_FEATURE_ID),
      ).toBe(false)
      expect(isBrainTravelPlanningEnabled()).toBe(false)
      expect(tryBuildTravelPlanningBlueprint({})).toBeNull()
      expect(TRAVEL_PLANNING_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.booking).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.pricing).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.wiredIntoExternalApis).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(TRAVEL_PLANNING_ARCHITECTURE.businessLogic).toBe(false)
      expect(
        TRAVEL_PLANNING_ARCHITECTURE.distinctFromPhase6PlanningEngine,
      ).toBe(true)
      expect(getFeatureRegistry().get('brain.planning_engine')?.id).toBe(
        'brain.planning_engine',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s7',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s7',
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
    it('exposes input hints, pipeline, and components', () => {
      expect(assertTravelPlanningIsolation().architectureOnly).toBe(true)
      expect(TravelPlanningRegistry.list()).toHaveLength(
        TRAVEL_PLANNING_SECTION_IDS.length,
      )
      expect(TRAVEL_PLANNING_INPUT_HINTS).toEqual(
        expect.arrayContaining([
          'traveler_profile',
          'conversation_context',
          'intent',
          'preferences',
          'budget',
          'dates',
          'destination',
        ]),
      )
      expect(TRAVEL_PLANNING_PIPELINE_STAGES).toContain('attach_intent')
      expect(TRAVEL_PLANNING_PIPELINE_STAGES).toContain('build_plan_structure')
      expect(TRAVEL_PLANNING_PIPELINE_STAGES).toContain('snapshot')
      expect(TRAVEL_PLANNING_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'planning_engine',
          'planning_strategy',
          'planning_constraints',
          'planning_alternatives',
          'travel_plan_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelPlanningBlueprint({
        enabled: true,
        sessionId: 'plan-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.engine.books).toBe(false)
      expect(blueprint?.travelPlan.books).toBe(false)
      expect(blueprint?.travelPlan.destinationHint).toBeNull()
      expect(blueprint?.optimization.executed).toBe(false)
      expect(blueprint?.revision.persisted).toBe(false)
      expect(blueprint?.versioning.version).toBe(0)
      expect(blueprint?.planningConfidence.bandHint).toBe('medium')
      expect(blueprint?.planningValidation.valid).toBe(true)
      expect(blueprint?.alternatives.alternatives).toHaveLength(0)
      expect(blueprint?.registry).toHaveLength(
        TRAVEL_PLANNING_SECTION_IDS.length,
      )

      const direct = buildTravelPlanningBlueprint({ sessionId: 'p2' })
      expect(direct.version).toBe('7.7.0-travel-planning')
      expect(
        TravelPlanningEngine.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
