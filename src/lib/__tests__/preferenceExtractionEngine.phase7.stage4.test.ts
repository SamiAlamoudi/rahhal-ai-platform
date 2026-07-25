/**
 * Phase 7 Stage 4 — AI Smart Preference Extraction Engine architecture tests.
 * Contracts/blueprints only. No LLM / DB / Runtime / recommendation execution.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID,
  PREFERENCE_CATEGORIES,
  PREFERENCE_EXTRACTION_ARCHITECTURE,
  PREFERENCE_EXTRACTION_SECTION_IDS,
  PREFERENCE_PIPELINE_STAGES,
  PreferenceExtractionEngine,
  PreferenceExtractionRegistry,
  assertPreferenceExtractionIsolation,
  buildPreferenceExtractionBlueprint,
  isBrainPreferenceExtractionEnabled,
  tryBuildPreferenceExtractionBlueprint,
} from '../orchestration/preferenceExtractionEngine'

describe('Phase 7 Stage 4 — AI Preference Extraction Engine (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.preference_extraction default OFF', () => {
      const def = getFeatureRegistry().get(
        BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID,
      )
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.personalization_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID),
      ).toBe(false)
      expect(isBrainPreferenceExtractionEnabled()).toBe(false)
      expect(tryBuildPreferenceExtractionBlueprint({})).toBeNull()
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.recommendationExecution).toBe(
        false,
      )
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.httpRequests).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.businessLogic).toBe(false)
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.formFillingRequired).toBe(false)
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s4',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s4',
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
    it('exposes categories, pipeline stages, and components', () => {
      expect(assertPreferenceExtractionIsolation().architectureOnly).toBe(true)
      expect(PreferenceExtractionRegistry.list()).toHaveLength(
        PREFERENCE_EXTRACTION_SECTION_IDS.length,
      )
      expect(PREFERENCE_CATEGORIES).toEqual(
        expect.arrayContaining([
          'destination',
          'accommodation',
          'budget',
          'food',
          'weather',
          'travel_style',
        ]),
      )
      expect(PREFERENCE_PIPELINE_STAGES).toContain('detect_explicit')
      expect(PREFERENCE_PIPELINE_STAGES).toContain('detect_implicit')
      expect(PREFERENCE_PIPELINE_STAGES).toContain('merge')
      expect(PREFERENCE_EXTRACTION_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'preference_extraction_engine',
          'conversation_preference_parser',
          'extracted_preference',
          'preference_candidate',
          'preference_evidence',
          'preference_update',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildPreferenceExtractionBlueprint({
        enabled: true,
        sessionId: 'px-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.engine.execution).toBe('none')
      expect(blueprint?.conversationParser.execution).toBe('none')
      expect(blueprint?.implicitDetector.execution).toBe('none')
      expect(blueprint?.explicitDetector.execution).toBe('none')
      expect(blueprint?.revisionHistory.persisted).toBe(false)
      expect(blueprint?.freshnessModel.freshnessBandHint).toBe('unknown')
      expect(blueprint?.extractedPreferences).toHaveLength(0)
      expect(blueprint?.preferenceCandidates).toHaveLength(0)
      expect(blueprint?.preferenceEvidence).toHaveLength(0)
      expect(blueprint?.preferenceValidations).toHaveLength(0)
      expect(blueprint?.preferenceUpdates).toHaveLength(0)
      expect(blueprint?.categories.categories).toHaveLength(
        PREFERENCE_CATEGORIES.length,
      )
      expect(blueprint?.destinationPreferences.categoryId).toBe('destination')
      expect(blueprint?.travelStylePreferences.categoryId).toBe('travel_style')
      expect(blueprint?.registry).toHaveLength(
        PREFERENCE_EXTRACTION_SECTION_IDS.length,
      )

      const direct = buildPreferenceExtractionBlueprint({ sessionId: 'px2' })
      expect(direct.version).toBe('7.4.0-preference-extraction')
      expect(
        PreferenceExtractionEngine.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
