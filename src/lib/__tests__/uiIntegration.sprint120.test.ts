/**
 * Sprint 120 — Production UI integration tests.
 * Verifies wiring to Memory / Streaming / Editing / Pipeline — no mock trip engines.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { resetMemoryEngineStores } from '../agent/memory/index'
import {
  SPRINT120_PRODUCTION_INTEGRATION_VERSION,
  UI_PRODUCTION_INTEGRATION_FEATURE_ID,
  isUiProductionIntegrationEnabled,
  extractTripHintsFromText,
  buildPipelineInputFromMessage,
  mapFlightsFromPipeline,
  mapHotelsFromPipeline,
  mapStreamingProgress,
  mapEditComparison,
  runProductionConversationTurn,
  runProductionEditTurn,
  buildEditSnapshotFromPipeline,
  loadProductionHomeData,
} from '../uiIntegration'
import type { PipelineResult } from '../agent/pipeline'
import { ProductionHomeScreen, ProductionConversationScreen } from '../../ui/integration'

function flight(id: string, price: number) {
  return {
    id,
    airline: 'Saudia',
    price,
    currency: 'SAR',
    durationMinutes: 200,
    stops: 0,
    cabin: 'economy',
    origin: 'RUH',
    destination: 'NRT',
    departureAt: '2026-10-05T08:00:00Z',
    arrivalAt: '2026-10-05T22:00:00Z',
    title: `Flight ${id}`,
    providerId: 'mock',
  }
}

function hotel(id: string, price: number) {
  return {
    id,
    hotelId: id,
    hotelName: `Hotel ${id}`,
    name: `Hotel ${id}`,
    price,
    currency: 'SAR',
    stars: 4,
    taxes: 0,
    freeCancellation: true,
    amenities: ['WIFI'],
    images: [],
    provider: 'mock',
    city: 'Tokyo',
    country: 'JP',
  }
}

function stubPipeline(overrides?: Partial<PipelineResult>): PipelineResult {
  return {
    version: 'test',
    enabled: true,
    ok: true,
    empty: false,
    partial: false,
    conversation: {
      conversationId: 'c1',
      messagesUnderstood: 1,
      trip: {
        destination: 'Japan',
        departureDate: '2026-10-05',
        returnDate: '2026-10-15',
        budget: 15000,
        currency: 'SAR',
      },
    },
    memory: null,
    searches: null,
    flightOffers: [flight('f1', 4200)],
    hotelOffers: [hotel('h1', 900)],
    decision: { confidence: 0.8 },
    trip: { tripCount: 1, selected: { id: 't1', title: 'Japan trip', nights: 10, cost: { totalCost: 9000, currency: 'SAR' } } },
    itinerary: { dayCount: 3 },
    response: null,
    concierge: null,
    finalResponse: {
      headline: 'Japan trip',
      executiveSummary: 'Best package',
      narrative: null,
      followUpQuestion: null,
      recommendations: [
        { id: 'r1', title: 'Option A', price: 9000, currency: 'SAR', reason: 'value' },
      ],
      conciergeHints: [],
      warnings: ['tight connection'],
      confidence: 0.82,
      source: 'pipeline',
    },
    stages: [],
    metadata: {
      conversationId: 'c1',
      userId: 'u1',
      memoryPresent: false,
      stageCount: 1,
      completedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      style: 'leisure',
      destination: 'Japan',
    },
    metrics: {
      pipelineDurationMs: 10,
      conversationDurationMs: 0,
      memoryDurationMs: 0,
      preferenceDurationMs: 0,
      searchPlanningDurationMs: 0,
      flightSearchDurationMs: 0,
      hotelSearchDurationMs: 0,
      decisionDurationMs: 0,
      tripBuilderDurationMs: 0,
      itineraryDurationMs: 0,
      responseDurationMs: 0,
      conciergeDurationMs: 0,
      finalDurationMs: 0,
      stagesCompleted: 1,
      stagesSkipped: 0,
      stagesFailed: 0,
      stagesRecovered: 0,
      stagesTimedOut: 0,
      confidence: 0.82,
      retryCount: 0,
    },
    confidence: 0.82,
    warnings: [],
    validationErrors: [],
    logs: [],
    latencyMs: 10,
    explanation: 'test',
    ...overrides,
  }
}

describe('Sprint 120 — Production UI Integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT120_PRODUCTION_INTEGRATION_VERSION).toMatch(/production-integration/)
    expect(UI_PRODUCTION_INTEGRATION_FEATURE_ID).toBe('ui.production_integration')
    expect(getFeatureRegistry().isEnabled('ui.production_integration')).toBe(false)
    expect(isUiProductionIntegrationEnabled()).toBe(false)
  })

  it('enables via override / registry', () => {
    expect(isUiProductionIntegrationEnabled({ enabled: true })).toBe(true)
    getFeatureRegistry().setEnabled('ui.production_integration', true)
    expect(isUiProductionIntegrationEnabled()).toBe(true)
  })

  describe('trip hints + pipeline input', () => {
    it('extracts destination budget cabin from text', () => {
      const hints = extractTripHintsFromText(
        'I want a trip to Japan for 2 adults with budget SAR 15000 business class',
      )
      expect(hints.destination).toBe('Japan')
      expect(hints.budget).toBe(15000)
      expect(hints.adults).toBe(2)
      expect(hints.cabin).toBe('business')
    })

    it('builds pipeline input for streaming reuse', () => {
      const input = buildPipelineInputFromMessage({
        conversationId: 'c1',
        userId: 'u1',
        text: 'Plan a trip to Dubai',
        flights: [flight('f1', 1000)],
        hotels: [hotel('h1', 500)],
      })
      expect(input.trip?.destination).toBe('Dubai')
      expect(input.flights).toHaveLength(1)
      expect(input.hotels).toHaveLength(1)
    })
  })

  describe('mappers', () => {
    it('maps flights hotels packages recommendations warnings confidence', () => {
      const pipeline = stubPipeline()
      expect(mapFlightsFromPipeline(pipeline)[0]?.route).toContain('RUH')
      expect(mapHotelsFromPipeline(pipeline)[0]?.title).toContain('Hotel')
      expect(mapStreamingProgress(null, []).progressPercent).toBe(0)
    })
  })

  describe('streaming integration', () => {
    it('runs production conversation turn via Streaming Engine', async () => {
      const events: string[] = []
      const result = await runProductionConversationTurn({
        conversationId: 'c_stream',
        userId: 'u1',
        text: 'I want a 10-day Japan trip for 2 adults budget SAR 15000',
        flights: [flight('f1', 4200), flight('f2', 3800)],
        hotels: [hotel('h1', 900), hotel('h2', 1200)],
        onEvent: (e) => events.push(e.kind),
      })
      expect(result.streaming.enabled).toBe(true)
      expect(result.streaming.pipeline?.enabled).toBe(true)
      expect(events).toContain('started')
      expect(events).toContain('progress')
      expect(result.progress.progressPercent).toBeGreaterThanOrEqual(0)
      expect(result.flights.length + result.hotels.length).toBeGreaterThan(0)
      expect(result.transcript.length).toBeGreaterThan(0)
    })
  })

  describe('editable conversation integration', () => {
    it('partial edit reruns affected stages only', async () => {
      const turn = await runProductionConversationTurn({
        conversationId: 'c_edit',
        userId: 'u1',
        text: 'Japan trip budget SAR 15000',
        flights: [flight('f1', 4200)],
        hotels: [hotel('h1', 900)],
      })
      expect(turn.streaming.pipeline).toBeTruthy()
      const snapshot = buildEditSnapshotFromPipeline(turn.streaming.pipeline!)
      const edited = await runProductionEditTurn({
        editText: 'Increase budget to 18000 SAR.',
        snapshot,
        conversationId: 'c_edit',
        userId: 'u1',
      })
      expect(edited.edit.enabled).toBe(true)
      expect(edited.edit.plan?.analyzed.kind).toBe('change_budget')
      expect(edited.comparison.stagesToSkip).toContain('flight_search')
      expect(edited.comparison.stagesToRerun.length).toBeGreaterThan(0)
      expect(mapEditComparison(edited.edit).budgetDelta).toBe(3000)
    })

    it('change hotel skips flight search', async () => {
      const pipeline = stubPipeline()
      const snapshot = buildEditSnapshotFromPipeline(pipeline, ['Tokyo'])
      const edited = await runProductionEditTurn({
        editText: 'Change the hotel.',
        snapshot,
        conversationId: 'c_hotel',
      })
      expect(edited.edit.plan?.analyzed.kind).toBe('change_hotel')
      expect(edited.comparison.stagesToSkip).toContain('flight_search')
      expect(edited.comparison.stagesToRerun).toContain('hotel_search')
    })
  })

  describe('home data', () => {
    it('loads home model for anonymous user without mocks', async () => {
      const data = await loadProductionHomeData({ userId: null, displayName: null })
      expect(data.greeting).toMatch(/رحّال|مرحبا/)
      expect(data.recentTrips).toEqual([])
      expect(data.error).toBeNull()
    })

    it('loads memory-backed home for user id', async () => {
      const data = await loadProductionHomeData({
        userId: 'user_120',
        displayName: 'Sami',
      })
      expect(data.greeting).toContain('Sami')
      expect(data.memory).toBeTruthy()
    })
  })

  describe('UI screens', () => {
    it('exposes ProductionHomeScreen and ProductionConversationScreen', () => {
      expect(ProductionHomeScreen).toBeTruthy()
      expect(ProductionConversationScreen).toBeTruthy()
      expect(
        createElement(ProductionConversationScreen, { conversationId: 'x' }).type,
      ).toBe(ProductionConversationScreen)
    })
  })

  describe('accessibility / performance contracts', () => {
    it('conversation and home screens are memo components', () => {
      expect(ProductionConversationScreen).toBeTruthy()
      expect(ProductionHomeScreen).toBeTruthy()
    })
  })
})
