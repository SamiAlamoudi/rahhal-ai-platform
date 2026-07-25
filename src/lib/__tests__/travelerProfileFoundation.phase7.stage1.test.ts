/**
 * Phase 7 Stage 1 — Traveler Profile Foundation architecture tests.
 * Contracts/blueprints only. No DB / auth / storage / OCR / LLM / Runtime.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_TRAVELER_PROFILE_FEATURE_ID,
  PROFILE_PREFERENCE_DOMAINS,
  PROFILE_SECTION_IDS,
  ProfileRegistry,
  TRAVELER_PROFILE_ARCHITECTURE,
  TravelerProfileFoundation,
  assertTravelerProfileIsolation,
  buildTravelerProfileBlueprint,
  isBrainTravelerProfileEnabled,
  tryBuildTravelerProfileBlueprint,
} from '../orchestration/travelerProfileFoundation'

describe('Phase 7 Stage 1 — Traveler Profile Foundation (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.traveler_profile default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_TRAVELER_PROFILE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.runtime_orchestrator'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_TRAVELER_PROFILE_FEATURE_ID),
      ).toBe(false)
      expect(isBrainTravelerProfileEnabled()).toBe(false)
      expect(tryBuildTravelerProfileBlueprint({})).toBeNull()
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoAuthentication).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoStorage).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.passportOcr).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.httpRequests).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.businessLogic).toBe(false)
      expect(
        TRAVELER_PROFILE_ARCHITECTURE.distinctFromUiTravelerProfile,
      ).toBe(true)
      expect(getFeatureRegistry().get('ui.traveler_profile')?.id).toBe(
        'ui.traveler_profile',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s1',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s1',
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
    it('exposes registry sections and preference domains', () => {
      expect(assertTravelerProfileIsolation().architectureOnly).toBe(true)
      expect(ProfileRegistry.list()).toHaveLength(PROFILE_SECTION_IDS.length)
      expect(PROFILE_PREFERENCE_DOMAINS).toEqual(
        expect.arrayContaining([
          'travel_style',
          'budget',
          'accommodation',
          'food',
          'accessibility',
          'privacy',
        ]),
      )
      expect(TRAVELER_PROFILE_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'traveler_profile',
          'traveler_identity',
          'passport_metadata',
          'consent_registry',
          'profile_timeline',
          'profile_evidence_builder',
          'travel_taste_analyzer_contract',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelerProfileBlueprint({
        enabled: true,
        sessionId: 'p-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.profile.execution).toBe('none')
      expect(blueprint?.passportMetadata.ocr).toBe(false)
      expect(blueprint?.passportMetadata.stored).toBe(false)
      expect(blueprint?.visaMetadata.stored).toBe(false)
      expect(blueprint?.auditTrail.persisted).toBe(false)
      expect(blueprint?.status.status).toBe('draft')
      expect(blueprint?.versioning.version).toBe(0)
      expect(blueprint?.validation.valid).toBe(true)
      expect(blueprint?.consentRegistry.entries.every((e) => !e.grantedHint)).toBe(
        true,
      )
      expect(blueprint?.companionProfiles).toHaveLength(0)
      expect(blueprint?.evidenceBuilder.execution).toBe('none')
      expect(blueprint?.travelerMemory.execution).toBe('none')
      expect(blueprint?.contextEnrichment.execution).toBe('none')
      expect(blueprint?.preferenceLearning.execution).toBe('none')
      expect(blueprint?.travelTasteAnalyzer.execution).toBe('none')
      expect(blueprint?.registry).toHaveLength(PROFILE_SECTION_IDS.length)

      const direct = buildTravelerProfileBlueprint({ sessionId: 'p2' })
      expect(direct.version).toBe('7.1.0-traveler-profile')
      expect(
        TravelerProfileFoundation.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
