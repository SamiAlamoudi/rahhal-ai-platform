/**
 * Sprint 103 — Alpha Integration & End-to-End Experience tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { emptyMemory } from '../agent/types'
import type { AgentProviderMeta } from '../agent/types'
import {
  SPRINT103_ALPHA_INTEGRATION_VERSION,
  allStagesConnected,
  ALPHA_JOURNEY_STAGES,
  resolveJourneyPath,
  listKnownJourneyPaths,
  bookingComposeFromAgentMeta,
  resolveAlphaNextStep,
  reportAlphaIntegrationFlags,
  degradationForMissing,
  buildAlphaIntegrationReport,
  resolveBookingEntryPath,
} from '../alphaIntegration'

function metaWithAssistant(ready = true): AgentProviderMeta {
  const memory = emptyMemory()
  memory.requirements.destination = 'Dubai'
  memory.requirements.origin = 'Riyadh'
  memory.requirements.startDate = '2026-08-15'
  memory.requirements.endDate = '2026-08-20'
  memory.requirements.travelers = 2
  memory.requirements.budgetCurrency = 'SAR'
  return {
    kind: 'travel_agent',
    version: 2,
    memory,
    tripPlan: null,
    itinerary: null,
    bookingAssistant: {
      version: '1.0.0-booking-assistant',
      conversationId: 'conv_103',
      enabled: true,
      sectionIds: ['readiness', 'summary'],
      sectionCount: 2,
      readinessStatus: 'ready_to_book',
      readyToBook: ready,
      nextAction: 'Proceed to booking',
      confidenceLevel: 'high',
      confidenceScore: 0.9,
      durationMs: 10,
      experience: {
        version: '1.0.0-booking-assistant',
        conversationId: 'conv_103',
        enabled: true,
        sections: [],
        sectionIds: ['readiness'],
        readinessStatus: 'ready_to_book',
        readyToBook: ready,
        nextAction: 'Proceed to booking',
        confidenceScore: 0.9,
        confidenceLevel: 'high',
        durationMs: 10,
      },
    },
    alphaTravelerExperience: {
      version: '1.0.0-alpha-assembly',
      conversationId: 'conv_103',
      enabled: true,
      sectionIds: ['flight', 'hotel', 'package'],
      sectionCount: 3,
      finalRecommendation: 'Dubai package',
      confidenceLevel: 'high',
      confidenceScore: 0.9,
      nextAction: 'Review',
      durationMs: 8,
      experience: {
        version: '1.0.0-alpha-assembly',
        conversationId: 'conv_103',
        enabled: true,
        sections: [
          {
            id: 'flight',
            flightId: 'flt_1',
            airline: 'Saudia',
            origin: 'RUH',
            destination: 'DXB',
            price: 1200,
            currency: 'SAR',
          },
          {
            id: 'hotel',
            hotelId: 'htl_1',
            name: 'Marina Hotel',
            price: 2200,
            currency: 'SAR',
          },
          {
            id: 'package',
            packageId: 'pkg_1',
            title: 'Dubai balanced escape',
            totalPrice: 3600,
            currency: 'SAR',
          },
        ],
        sectionIds: ['flight', 'hotel', 'package'],
        finalRecommendation: 'Dubai package',
        confidenceLevel: 'high',
        confidenceScore: 0.9,
        nextAction: 'Review',
        durationMs: 8,
      },
    },
  }
}

describe('Sprint 103 — Alpha Integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes integration version and connected stages', () => {
    expect(SPRINT103_ALPHA_INTEGRATION_VERSION).toMatch(/alpha-integration/)
    expect(allStagesConnected()).toBe(true)
    expect(ALPHA_JOURNEY_STAGES.length).toBeGreaterThanOrEqual(12)
  })

  describe('routing', () => {
    it('resolves /new-chat and /booking aliases without broken paths', () => {
      expect(resolveJourneyPath('/new-chat')).toBe('/chat')
      expect(resolveJourneyPath('/booking', { bookingExecutionEnabled: true }))
        .toBe('/booking-assistant/review')
      expect(resolveJourneyPath('/booking', { bookingExecutionEnabled: false }))
        .toBe('/booking/review')
      expect(listKnownJourneyPaths()).toContain('/chat')
      expect(listKnownJourneyPaths()).toContain('/my-trips')
      expect(listKnownJourneyPaths()).toContain('/booking/review')
      expect(listKnownJourneyPaths()).toContain('/booking/confirmation')
      expect(resolveBookingEntryPath()).toMatch(/booking/)
    })
  })

  describe('feature flags', () => {
    it('reports Alpha journey flags including aliases', () => {
      const flags = reportAlphaIntegrationFlags()
      const ids = flags.map((f) => f.id)
      expect(ids).toContain('ai.concierge')
      expect(ids).toContain('ai.live_conversation')
      expect(ids).toContain('ai.alpha_experience')
      expect(ids).toContain('ai.booking_execution_confirmation')
      expect(ids).toContain('ai.my_trips_dashboard')
      expect(getFeatureRegistry().isEnabled('ai.live_conversation')).toBe(true)
      expect(getFeatureRegistry().isEnabled('ai.booking_execution_confirmation')).toBe(true)
    })

    it('flag OFF preserves legacy booking entry', () => {
      getFeatureRegistry().setEnabled('ai.booking_execution_confirmation', false)
      expect(resolveJourneyPath('/booking', {
        bookingExecutionEnabled: getFeatureRegistry().isEnabled('ai.booking_execution_confirmation'),
      })).toBe('/booking/review')
    })
  })

  describe('data flow', () => {
    it('maps agent meta → booking compose without duplicated engines', () => {
      const compose = bookingComposeFromAgentMeta(metaWithAssistant())
      expect(compose.destination).toBe('Dubai')
      expect(compose.flightLabel).toMatch(/Saudia/)
      expect(compose.hotelLabel).toMatch(/Marina/)
      expect(compose.packageLabel).toMatch(/Dubai/)
      expect(compose.total).toBe(3600)
      expect(compose.offerRefs?.flightId).toBe('flt_1')
    })

    it('resolves next step to booking assistant review when ready', () => {
      const next = resolveAlphaNextStep({
        meta: metaWithAssistant(true),
        bookingExecutionEnabled: true,
        myTripsEnabled: true,
        locale: 'en',
      })
      expect(next?.path).toBe('/booking-assistant/review')
      expect(next?.state?.compose).toBeTruthy()
    })
  })

  describe('degradation', () => {
    it('returns graceful messages for missing offers / failures', () => {
      const items = degradationForMissing({
        hasFlight: false,
        hasHotel: false,
        hasPackage: false,
        hasRecommendation: false,
        bookingFailed: true,
        providerUnavailable: true,
        emptyTrip: true,
      })
      const codes = items.map((i) => i.code)
      expect(codes).toContain('missing_flights')
      expect(codes).toContain('missing_hotel')
      expect(codes).toContain('missing_package')
      expect(codes).toContain('no_recommendation')
      expect(codes).toContain('booking_failed')
      expect(codes).toContain('provider_unavailable')
      expect(codes).toContain('empty_trip')
      expect(items.every((i) => i.message.length > 0)).toBe(true)
    })
  })

  describe('integration report', () => {
    it('builds a production readiness report', () => {
      const report = buildAlphaIntegrationReport({
        meta: metaWithAssistant(),
        hasFlight: true,
        hasHotel: true,
        hasPackage: true,
        hasRecommendation: true,
      })
      expect(report.stagesConnected).toBe(true)
      expect(report.nextStepPath).toBe('/booking-assistant/review')
      expect(report.productionReadinessScore).toBeGreaterThanOrEqual(80)
      expect(report.bookingCompose?.destination).toBe('Dubai')
    })
  })
})
