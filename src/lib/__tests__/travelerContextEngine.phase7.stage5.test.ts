/**
 * Phase 7 Stage 5 — Traveler Context Engine architecture tests.
 * Contracts/blueprints only. No LLM / Runtime / DB / Memory wiring.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_CONTEXT_ENGINE_FEATURE_ID,
  CONTEXT_LIFECYCLE_ACTIONS,
  CONTEXT_PIPELINE_STAGES,
  CONTEXT_SECTION_IDS,
  ContextRegistry,
  TRAVELER_CONTEXT_ARCHITECTURE,
  TravelerContextEngine,
  assertTravelerContextIsolation,
  buildTravelerContextEngineBlueprint,
  isBrainContextEngineEnabled,
  tryBuildTravelerContextEngineBlueprint,
} from '../orchestration/travelerContextEngine'

describe('Phase 7 Stage 5 — Traveler Context Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.context_engine default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_CONTEXT_ENGINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.preference_extraction'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_CONTEXT_ENGINE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainContextEngineEnabled()).toBe(false)
      expect(tryBuildTravelerContextEngineBlueprint({})).toBeNull()
      expect(TRAVELER_CONTEXT_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.httpRequests).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.businessLogic).toBe(false)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.distinctFromMemoryEngine).toBe(true)
      expect(TRAVELER_CONTEXT_ARCHITECTURE.distinctFromContextMemory).toBe(true)
      expect(getFeatureRegistry().get('brain.context_memory')?.id).toBe(
        'brain.context_memory',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s5',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s5',
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
    it('exposes sections, pipeline, and lifecycle', () => {
      expect(assertTravelerContextIsolation().architectureOnly).toBe(true)
      expect(ContextRegistry.list()).toHaveLength(CONTEXT_SECTION_IDS.length)
      expect(CONTEXT_PIPELINE_STAGES).toContain('resolve_current_intent')
      expect(CONTEXT_PIPELINE_STAGES).toContain('merge_contexts')
      expect(CONTEXT_PIPELINE_STAGES).toContain('emit_snapshot')
      expect(CONTEXT_LIFECYCLE_ACTIONS).toEqual(
        expect.arrayContaining([
          'open',
          'refresh',
          'merge',
          'validate',
          'snapshot',
          'close',
        ]),
      )
      expect(TRAVELER_CONTEXT_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'context_engine',
          'conversation_context',
          'current_trip_context',
          'visa_context',
          'context_merge_rules',
          'traveler_context_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelerContextEngineBlueprint({
        enabled: true,
        sessionId: 'ctx-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.engine.distinctFromMemory).toBe(true)
      expect(blueprint?.conversation.intentHint).toBeNull()
      expect(blueprint?.trip.tripIdHint).toBeNull()
      expect(blueprint?.session.sessionId).toBe('ctx-demo')
      expect(blueprint?.confidence.bandHint).toBe('medium')
      expect(blueprint?.validation.valid).toBe(true)
      expect(blueprint?.contextFreshness.freshnessBandHint).toBe('unknown')
      expect(blueprint?.budgetContext.amountHint).toBeNull()
      expect(blueprint?.environmentContext.locationHint).toBeNull()
      expect(blueprint?.registry).toHaveLength(CONTEXT_SECTION_IDS.length)

      const direct = buildTravelerContextEngineBlueprint({ sessionId: 'c2' })
      expect(direct.version).toBe('7.5.0-traveler-context')
      expect(
        TravelerContextEngine.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
