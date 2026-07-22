/**
 * Sprint 113 — AI Orchestrator production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { resetMemoryEngineStores } from '../agent/memory/index'
import {
  SPRINT113_AI_ORCHESTRATOR_VERSION,
  PIPELINE_ORCHESTRATOR_FEATURE_ID,
  isPipelineOrchestratorEnabled,
  runAIOrchestrator,
  buildOrchestratorPlan,
  createAIOrchestrator,
  type OrchestratorInput,
  type OrchestratorStageAdapters,
  type StageAdapterResult,
} from '../agent/orchestrator'

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
    destination: 'DXB',
    departureAt: '2026-09-15T08:00:00Z',
    arrivalAt: '2026-09-15T11:00:00Z',
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
    city: 'Dubai',
    country: 'AE',
  }
}

function baseInput(overrides?: Partial<OrchestratorInput>): OrchestratorInput {
  return {
    conversationId: 'orch_113',
    userId: 'user_113',
    messages: [{ role: 'user', text: 'I always fly Saudia. Plan a trip to Dubai.' }],
    trip: {
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-09-15',
      returnDate: '2026-09-18',
      checkInDate: '2026-09-15',
      checkOutDate: '2026-09-18',
      adults: 2,
      budget: 5000,
      currency: 'SAR',
    },
    flights: [flight('f1', 1200), flight('f2', 900)],
    hotels: [hotel('h1', 800), hotel('h2', 1500)],
    ...overrides,
  }
}

function okStage(
  artifact: Record<string, unknown> = {},
  patch?: StageAdapterResult['finalPatch'],
): StageAdapterResult {
  return {
    ok: true,
    durationMs: 5,
    confidence: 0.8,
    artifact,
    finalPatch: patch ?? null,
  }
}

function stubAdapters(overrides?: OrchestratorStageAdapters): OrchestratorStageAdapters {
  return {
    memory: async () =>
      okStage({
        enabled: true,
        ok: true,
        conciergeHints: ['Matches your previous travel preferences.'],
        responseComposerNotes: ['memory_source:profile'],
      }),
    planner: async (_i, _c, plan) =>
      okStage({ reasons: plan.reasons, executeSearch: plan.executeSearch }),
    providers: async () =>
      okStage({ flightCount: 2, hotelCount: 2, reused: true }),
    tripBuilder: async () =>
      okStage(
        {
          enabled: true,
          ok: true,
          tripCount: 2,
          selectedId: 'trip_1',
          confidence: 0.82,
          responseComposerInput: {
            conversationId: 'orch_113',
            flights: [
              {
                id: 'f1',
                title: 'Flight f1',
                price: 1200,
                currency: 'SAR',
                durationMinutes: 200,
                stops: 0,
                airline: 'Saudia',
              },
            ],
            decisionConfidence: 0.82,
            labeled: { bestOverallId: 'f1' },
          },
        },
      ),
    decision: async () =>
      okStage({ passThrough: true, confidence: 0.82 }),
    responseComposer: async () =>
      okStage(
        {
          enabled: true,
          empty: false,
          recommendationCount: 1,
          result: {
            recommendations: [
              {
                kind: 'best_overall',
                label: 'Best Overall',
                optionId: 'f1',
                title: 'Flight f1',
                price: 1200,
                currency: 'SAR',
                durationMinutes: 200,
                stops: 0,
                cabin: 'economy',
                airline: 'Saudia',
                reason: 'Balanced',
              },
            ],
            confidence: { overall: 0.84 },
          },
        },
        {
          headline: 'Best trip options',
          executiveSummary: 'Selected a balanced itinerary.',
          recommendations: [
            {
              id: 'f1',
              title: 'Flight f1',
              price: 1200,
              currency: 'SAR',
              reason: 'Balanced',
            },
          ],
          confidence: 0.84,
        },
      ),
    concierge: async () =>
      okStage(
        { enabled: true, ok: true, narrative: 'I selected this option for balance.' },
        {
          narrative: 'I selected this option for balance.',
          conciergeHints: ['I selected this itinerary because it matches your previous travel preferences.'],
          confidence: 0.85,
        },
      ),
    ...overrides,
  }
}

describe('Sprint 113 — AI Orchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT113_AI_ORCHESTRATOR_VERSION).toMatch(/ai-orchestrator/)
    expect(PIPELINE_ORCHESTRATOR_FEATURE_ID).toBe('ai.orchestrator')
    expect(getFeatureRegistry().isEnabled('ai.orchestrator')).toBe(false)
    expect(isPipelineOrchestratorEnabled()).toBe(false)
  })

  describe('feature flag OFF/ON', () => {
    it('OFF preserves disabled legacy result', async () => {
      const result = await runAIOrchestrator(baseInput())
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.finalResponse?.source).toBe('disabled')
      expect(result.logs).toContain('ai_orchestrator_disabled')
    })

    it('ON runs the pipeline', async () => {
      const result = await runAIOrchestrator(baseInput(), {
        enabled: true,
        adapters: stubAdapters(),
      })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.plan).not.toBeNull()
      expect(result.finalResponse?.source).toBe('orchestrator')
      expect(result.finalResponse?.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('execution ordering', () => {
    it('records stages in pipeline order', async () => {
      const result = await runAIOrchestrator(baseInput(), {
        enabled: true,
        adapters: stubAdapters(),
      })
      const ids = result.stages.map((s) => s.id)
      expect(ids[0]).toBe('memory')
      expect(ids).toContain('planner')
      expect(ids).toContain('trip_builder')
      expect(ids).toContain('response_composer')
      expect(ids).toContain('concierge')
      expect(ids[ids.length - 1]).toBe('final')
    })
  })

  describe('planner decisions', () => {
    it('skips providers when offers already present', () => {
      const plan = buildOrchestratorPlan(baseInput())
      expect(plan.skipProviders).toBe(true)
      expect(plan.executeSearch).toBe(false)
      expect(plan.runTripBuilder).toBe(true)
    })

    it('asks follow-up and early-exits when destination missing', async () => {
      const result = await runAIOrchestrator(
        baseInput({
          trip: {
            origin: 'RUH',
            destination: null,
            departureDate: '2026-09-15',
          },
          flights: [],
          hotels: [],
        }),
        { enabled: true, adapters: stubAdapters() },
      )
      expect(result.plan?.askFollowUp).toBe(true)
      expect(result.plan?.earlyExit).toBe(true)
      expect(result.finalResponse?.source).toBe('early_exit')
      expect(result.finalResponse?.followUpQuestion).toMatch(/destination/i)
      expect(result.stages.find((s) => s.id === 'trip_builder')?.status).toBe(
        'skipped',
      )
    })

    it('reuses cached final response', async () => {
      const result = await runAIOrchestrator(
        baseInput({
          messages: [],
          cacheKey: 'cache_1',
          cachedFinalResponse: {
            headline: 'Cached',
            executiveSummary: 'From cache',
            recommendations: [
              {
                id: 'x',
                title: 'Cached trip',
                price: 1000,
                currency: 'SAR',
                reason: null,
              },
            ],
            followUpQuestion: null,
            narrative: null,
            conciergeHints: [],
            warnings: [],
            confidence: 0.9,
            source: 'cache',
          },
        }),
        { enabled: true, adapters: stubAdapters() },
      )
      expect(result.plan?.reuseCache).toBe(true)
      expect(result.finalResponse?.source).toBe('cache')
      expect(result.stages.some((s) => s.status === 'cached')).toBe(true)
    })

    it('can force skip trip builder and concierge', async () => {
      const result = await runAIOrchestrator(
        baseInput({
          stageOverrides: {
            runTripBuilder: false,
            runConcierge: false,
            runResponseComposer: true,
            runDecision: false,
          },
        }),
        { enabled: true, adapters: stubAdapters() },
      )
      expect(result.plan?.runTripBuilder).toBe(false)
      expect(result.plan?.runConcierge).toBe(false)
      expect(result.stages.find((s) => s.id === 'trip_builder')?.status).toBe(
        'skipped',
      )
      expect(result.stages.find((s) => s.id === 'concierge')?.status).toBe(
        'skipped',
      )
      expect(result.stages.find((s) => s.id === 'response_composer')?.status).toBe(
        'completed',
      )
    })

    it('executes search when forced and providers not skipped', () => {
      const plan = buildOrchestratorPlan(
        baseInput({
          flights: [],
          hotels: [],
          stageOverrides: {
            executeSearch: true,
            skipProviders: false,
            askFollowUp: false,
          },
        }),
      )
      expect(plan.executeSearch).toBe(true)
      expect(plan.skipProviders).toBe(false)
    })
  })

  describe('memory available / unavailable', () => {
    it('uses memory when userId present', async () => {
      const result = await runAIOrchestrator(baseInput(), {
        enabled: true,
        adapters: stubAdapters(),
      })
      expect(result.plan?.useMemory).toBe(true)
      expect(result.context?.memoryAvailable).toBe(true)
      expect(result.stages.find((s) => s.id === 'memory')?.status).toBe(
        'completed',
      )
    })

    it('skips memory when userId missing', async () => {
      const result = await runAIOrchestrator(baseInput({ userId: null }), {
        enabled: true,
        adapters: stubAdapters(),
      })
      expect(result.plan?.useMemory).toBe(false)
      expect(result.context?.memoryAvailable).toBe(false)
      expect(result.stages.find((s) => s.id === 'memory')?.status).toBe(
        'skipped',
      )
    })
  })

  describe('provider failures', () => {
    it('skips providers when status is unavailable', async () => {
      const result = await runAIOrchestrator(
        baseInput({
          flights: [],
          hotels: [],
          providerStatus: 'unavailable',
          stageOverrides: { askFollowUp: false },
        }),
        {
          enabled: true,
          adapters: stubAdapters({
            providers: async () => ({
              ok: false,
              durationMs: 3,
              error: 'provider down',
              artifact: { failed: true },
            }),
          }),
        },
      )
      expect(result.plan?.skipProviders).toBe(true)
      expect(result.stages.find((s) => s.id === 'providers')?.status).toBe(
        'skipped',
      )
    })

    it('records provider stage failure when adapter fails', async () => {
      const result = await runAIOrchestrator(
        baseInput({
          flights: [],
          hotels: [],
          stageOverrides: {
            executeSearch: true,
            skipProviders: false,
            askFollowUp: false,
            runTripBuilder: false,
            runDecision: false,
            runResponseComposer: false,
            runConcierge: false,
          },
        }),
        {
          enabled: true,
          adapters: stubAdapters({
            providers: async () => ({
              ok: false,
              durationMs: 2,
              error: 'RATE_LIMITED',
              artifact: null,
            }),
          }),
        },
      )
      expect(result.stages.find((s) => s.id === 'providers')?.status).toBe(
        'failed',
      )
      expect(result.metrics.stagesFailed).toBeGreaterThan(0)
    })
  })

  describe('metrics and confidence', () => {
    it('collects execution metrics and propagates confidence', async () => {
      const result = await runAIOrchestrator(baseInput(), {
        enabled: true,
        adapters: stubAdapters(),
      })
      expect(result.metrics.pipelineDurationMs).toBeGreaterThanOrEqual(0)
      expect(result.metrics.stagesCompleted).toBeGreaterThan(0)
      expect(result.finalResponse?.confidence).toBeGreaterThan(0)
      expect(result.context?.confidence).toBeGreaterThan(0)
      expect(result.metrics.totalTokens).toBeGreaterThan(0)
    })
  })

  describe('validation', () => {
    it('rejects invalid messages', async () => {
      const result = await runAIOrchestrator(
        // @ts-expect-error intentional invalid fixture
        { messages: [{ role: 'user' }] },
        { enabled: true, adapters: stubAdapters() },
      )
      expect(result.ok).toBe(false)
      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.finalResponse?.source).toBe('error')
    })
  })

  describe('default adapters integration (real public APIs)', () => {
    it('runs trip builder + response composer + concierge on supplied offers', async () => {
      const orchestrator = createAIOrchestrator({ enabled: true })
      const result = await orchestrator.run(baseInput())
      expect(result.enabled).toBe(true)
      expect(result.stages.some((s) => s.id === 'trip_builder')).toBe(true)
      expect(result.stages.some((s) => s.id === 'response_composer')).toBe(true)
      expect(result.finalResponse).not.toBeNull()
    })
  })
})
