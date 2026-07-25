/**
 * Phase 7 Stage 8 — Travel Search Orchestrator architecture tests.
 * Contracts/blueprints only. No provider calls / HTTP / SDKs / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID,
  SEARCH_INPUT_HINTS,
  SEARCH_ORCHESTRATOR_ARCHITECTURE,
  SEARCH_PIPELINE_STAGES,
  SEARCH_PROVIDER_KINDS,
  SEARCH_SECTION_IDS,
  SearchRegistry,
  TravelSearchOrchestrator,
  assertSearchOrchestratorIsolation,
  buildTravelSearchOrchestratorBlueprint,
  isBrainSearchOrchestratorEnabled,
  tryBuildTravelSearchOrchestratorBlueprint,
} from '../orchestration/travelSearchOrchestrator'

describe('Phase 7 Stage 8 — Travel Search Orchestrator (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.search_orchestrator default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.travel_planning'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID),
      ).toBe(false)
      expect(isBrainSearchOrchestratorEnabled()).toBe(false)
      expect(tryBuildTravelSearchOrchestratorBlueprint({})).toBeNull()
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.httpRequests).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.wiredIntoSdks).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.wiredIntoProviderApis).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.booking).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.pricing).toBe(false)
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(
        SEARCH_ORCHESTRATOR_ARCHITECTURE.distinctFromSprint24BrainSearch,
      ).toBe(true)
      expect(getFeatureRegistry().get('brain.search')?.id).toBe('brain.search')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s8',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s8',
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
    it('exposes providers, pipeline, and components', () => {
      expect(assertSearchOrchestratorIsolation().architectureOnly).toBe(true)
      expect(SearchRegistry.list()).toHaveLength(SEARCH_SECTION_IDS.length)
      expect(SEARCH_PROVIDER_KINDS).toEqual(
        expect.arrayContaining([
          'flight',
          'hotel',
          'activity',
          'transport',
          'restaurant',
          'generic_future',
        ]),
      )
      expect(SEARCH_INPUT_HINTS).toEqual(
        expect.arrayContaining([
          'travel_plan',
          'intent',
          'preferences',
          'budget',
          'destination',
        ]),
      )
      expect(SEARCH_PIPELINE_STAGES).toContain('build_search_request')
      expect(SEARCH_PIPELINE_STAGES).toContain('map_provider_requests')
      expect(SEARCH_ORCHESTRATOR_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'search_orchestrator',
          'provider_abstraction',
          'search_ranking',
          'search_request_output',
          'provider_request_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelSearchOrchestratorBlueprint({
        enabled: true,
        sessionId: 'search-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.orchestrator.execution).toBe('none')
      expect(blueprint?.orchestrator.providerCalled).toBe(false)
      expect(blueprint?.searchRequest.providerCalled).toBe(false)
      expect(blueprint?.providerRequest.sent).toBe(false)
      expect(blueprint?.providerResponse.received).toBe(false)
      expect(blueprint?.providerAbstraction.wired).toBe(false)
      expect(blueprint?.aggregation.executed).toBe(false)
      expect(blueprint?.revision.persisted).toBe(false)
      expect(blueprint?.confidence.bandHint).toBe('medium')
      expect(blueprint?.searchValidation.valid).toBe(true)
      expect(blueprint?.searchResult.candidateIds).toHaveLength(0)
      expect(blueprint?.registry).toHaveLength(SEARCH_SECTION_IDS.length)

      const direct = buildTravelSearchOrchestratorBlueprint({
        sessionId: 's2',
      })
      expect(direct.version).toBe('7.8.0-search-orchestrator')
      expect(
        TravelSearchOrchestrator.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
