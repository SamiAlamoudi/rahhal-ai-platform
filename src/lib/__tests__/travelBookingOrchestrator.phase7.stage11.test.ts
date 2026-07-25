/**
 * Phase 7 Stage 11 — Travel Booking Orchestrator architecture tests.
 * Contracts/blueprints only. No booking execution / providers / payments.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID,
  TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE,
  TRAVEL_BOOKING_PIPELINE_STAGES,
  TRAVEL_BOOKING_PROVIDER_KINDS,
  TRAVEL_BOOKING_SECTION_IDS,
  TRAVEL_BOOKING_STATE_HINTS,
  TravelBookingOrchestrator,
  TravelBookingRegistry,
  assertTravelBookingOrchestratorIsolation,
  buildTravelBookingOrchestratorBlueprint,
  isBrainBookingOrchestratorEnabled,
  tryBuildTravelBookingOrchestratorBlueprint,
} from '../orchestration/travelBookingOrchestrator'

describe('Phase 7 Stage 11 — Travel Booking Orchestrator (architecture)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + isolation', () => {
    it('registers brain.booking_orchestrator default OFF', () => {
      const def = getFeatureRegistry().get(BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['brain.offer_decision_engine'])
      expect(
        getFeatureRegistry().isEnabled(BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID),
      ).toBe(false)
      expect(isBrainBookingOrchestratorEnabled()).toBe(false)
      expect(tryBuildTravelBookingOrchestratorBlueprint({})).toBeNull()
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.wiredIntoRuntime).toBe(
        false,
      )
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.httpRequests).toBe(false)
      expect(
        TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.wiredIntoProviderApis,
      ).toBe(false)
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.bookingExecuted).toBe(
        false,
      )
      expect(
        TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.reservationsCreated,
      ).toBe(false)
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.payments).toBe(false)
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.notifications).toBe(false)
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.emails).toBe(false)
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.wiredIntoLlms).toBe(false)
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.wiredIntoDatabase).toBe(
        false,
      )
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.wiredIntoAuth).toBe(false)
      expect(
        TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.distinctFromBookingOrchestratorFlag,
      ).toBe(true)
      expect(
        TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.distinctFromLibBookingOrchestrator,
      ).toBe(true)
      expect(
        TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.distinctFromCoreBookingOrchestrator,
      ).toBe(true)
      expect(getFeatureRegistry().get('booking.orchestrator')?.id).toBe(
        'booking.orchestrator',
      )
      expect(getFeatureRegistry().get('brain.offer_decision_engine')?.id).toBe(
        'brain.offer_decision_engine',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p7s11',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-p7s11',
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
    it('exposes pipeline, lifecycle, and components', () => {
      expect(assertTravelBookingOrchestratorIsolation().architectureOnly).toBe(
        true,
      )
      expect(TravelBookingRegistry.list()).toHaveLength(
        TRAVEL_BOOKING_SECTION_IDS.length,
      )
      expect(TRAVEL_BOOKING_PIPELINE_STAGES).toContain('build_booking_request')
      expect(TRAVEL_BOOKING_PIPELINE_STAGES).toContain('plan_rollback')
      expect(TRAVEL_BOOKING_PIPELINE_STAGES).toContain('plan_retry')
      expect(TRAVEL_BOOKING_STATE_HINTS).toEqual(
        expect.arrayContaining([
          'idle',
          'preparing',
          'validated',
          'session_open',
          'confirmation_drafted',
        ]),
      )
      expect(TRAVEL_BOOKING_PROVIDER_KINDS).toEqual(
        expect.arrayContaining([
          'flight',
          'hotel',
          'activity',
          'generic_future',
        ]),
      )
      expect(TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE.components).toEqual(
        expect.arrayContaining([
          'booking_orchestrator',
          'booking_pipeline',
          'booking_lifecycle',
          'booking_provider_abstraction',
          'booking_request_output',
          'booking_confirmation_draft_output',
        ]),
      )
    })

    it('builds a full architecture blueprint when forced ON', () => {
      const blueprint = tryBuildTravelBookingOrchestratorBlueprint({
        enabled: true,
        sessionId: 'booking-demo',
        locale: 'ar',
      })
      expect(blueprint).not.toBeNull()
      expect(blueprint?.architectureOnly).toBe(true)
      expect(blueprint?.orchestrator.execution).toBe('none')
      expect(blueprint?.orchestrator.books).toBe(false)
      expect(blueprint?.orchestrator.providerCalled).toBe(false)
      expect(blueprint?.orchestrator.paymentsExecuted).toBe(false)
      expect(blueprint?.orchestrator.reservationsCreated).toBe(false)
      expect(blueprint?.orchestrator.notificationsSent).toBe(false)
      expect(blueprint?.bookingRequest.providerCalled).toBe(false)
      expect(blueprint?.providerAbstraction.wired).toBe(false)
      expect(blueprint?.audit.persisted).toBe(false)
      expect(blueprint?.revision.persisted).toBe(false)
      expect(blueprint?.bookingConfirmationDraft.confirmed).toBe(false)
      expect(blueprint?.bookingValidation.valid).toBe(true)
      expect(blueprint?.bookingConfidence.bandHint).toBe('medium')
      expect(blueprint?.lifecycle.currentStateHint).toBeNull()
      expect(blueprint?.registry).toHaveLength(TRAVEL_BOOKING_SECTION_IDS.length)

      const direct = buildTravelBookingOrchestratorBlueprint({
        sessionId: 's2',
      })
      expect(direct.version).toBe('7.11.0-booking-orchestrator')
      expect(
        TravelBookingOrchestrator.tryBuildBlueprint({ enabled: false }),
      ).toBeNull()
    })
  })
})
