/**
 * Sprint 115 — Unified AI Execution Pipeline production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { resetMemoryEngineStores } from '../agent/memory/index'
import {
  SPRINT115_EXECUTION_PIPELINE_VERSION,
  EXECUTION_PIPELINE_FEATURE_ID,
  isExecutionPipelineEnabled,
  runUnifiedExecutionPipeline,
  createPipelineRunner,
  createPipelineLogger,
  collectPipelineMetrics,
  validatePipelineInput,
  PIPELINE_STAGE_ORDER,
  createCompletedStageResult,
  createFailedStageResult,
  type PipelineInput,
  type PipelineStageAdapters,
  type PipelineStageResult,
} from '../agent/pipeline'

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

function baseInput(overrides?: Partial<PipelineInput>): PipelineInput {
  return {
    conversationId: 'pipe_115',
    userId: 'user_115',
    messages: [
      {
        role: 'user',
        text: 'I want a 10-day Japan trip in October for 2 adults with a budget of SAR 15000.',
      },
    ],
    trip: {
      origin: 'RUH',
      destination: 'Japan',
      departureDate: '2026-10-05',
      returnDate: '2026-10-15',
      checkInDate: '2026-10-05',
      checkOutDate: '2026-10-15',
      adults: 2,
      children: 0,
      budget: 15000,
      currency: 'SAR',
      style: 'leisure',
    },
    flights: [flight('f1', 4200), flight('f2', 3800)],
    hotels: [hotel('h1', 900), hotel('h2', 1400)],
    ...overrides,
  }
}

function okStage(
  stageId: PipelineStageResult['stageId'],
  artifact: Record<string, unknown> = {},
  confidence = 0.8,
): PipelineStageResult {
  return createCompletedStageResult({
    stageId,
    durationMs: 5,
    artifact,
    confidence,
  })
}

describe('Sprint 115 — Unified AI Execution Pipeline', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT115_EXECUTION_PIPELINE_VERSION).toMatch(/execution-pipeline/)
    expect(EXECUTION_PIPELINE_FEATURE_ID).toBe('ai.execution_pipeline')
    expect(getFeatureRegistry().isEnabled('ai.execution_pipeline')).toBe(false)
    expect(isExecutionPipelineEnabled()).toBe(false)
  })

  describe('feature flag OFF/ON', () => {
    it('OFF returns disabled result without running stages', async () => {
      const result = await runUnifiedExecutionPipeline(baseInput())
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.stages).toEqual([])
      expect(result.logs).toContain('execution_pipeline_disabled')
      expect(result.finalResponse?.source).toBe('disabled')
    })

    it('ON runs the full pipeline via options override', async () => {
      const result = await runUnifiedExecutionPipeline(baseInput(), { enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.stages.length).toBe(PIPELINE_STAGE_ORDER.length)
      expect(result.flightOffers.length).toBeGreaterThan(0)
      expect(result.hotelOffers.length).toBeGreaterThan(0)
      expect(result.trip).toBeTruthy()
      expect(result.itinerary).toBeTruthy()
      expect(result.response).toBeTruthy()
      expect(result.concierge).toBeTruthy()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.metadata.destination).toBe('Japan')
    })

    it('ON via registry enable', async () => {
      getFeatureRegistry().setEnabled('ai.execution_pipeline', true)
      expect(isExecutionPipelineEnabled()).toBe(true)
      const result = await runUnifiedExecutionPipeline(baseInput())
      expect(result.enabled).toBe(true)
      expect(result.stages.length).toBeGreaterThan(0)
    })
  })

  describe('simple request', () => {
    it('executes conversation through final for leisure Japan trip', async () => {
      const result = await runUnifiedExecutionPipeline(baseInput(), { enabled: true })
      expect(result.conversation?.trip.destination).toBe('Japan')
      expect(result.metrics.stagesCompleted).toBeGreaterThan(0)
      expect(result.explanation).toMatch(/pipeline/i)
      expect(result.finalResponse?.confidence).toBeGreaterThan(0)
    })
  })

  describe('family trip', () => {
    it('infers / honors family style', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({
          trip: {
            ...baseInput().trip,
            style: 'family',
            children: 2,
            adults: 2,
          },
          messages: [{ role: 'user', text: 'Family vacation to Japan with 2 children' }],
        }),
        { enabled: true },
      )
      expect(result.conversation?.trip.style).toBe('family')
      expect(result.metadata.style).toBe('family')
      expect(result.ok).toBe(true)
    })
  })

  describe('business trip', () => {
    it('honors business style', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({
          trip: {
            ...baseInput().trip,
            style: 'business',
            cabin: 'business',
          },
          messages: [{ role: 'user', text: 'Business trip to Tokyo for meetings' }],
        }),
        { enabled: true },
      )
      expect(result.conversation?.trip.style).toBe('business')
      expect(result.ok).toBe(true)
    })
  })

  describe('memory present / absent', () => {
    it('memory absent when no userId', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({ userId: null }),
        { enabled: true },
      )
      const memoryStage = result.stages.find((s) => s.stageId === 'memory')
      expect(memoryStage?.status).toBe('skipped')
      expect(result.metadata.memoryPresent).toBe(false)
    })

    it('memory present path runs when userId provided', async () => {
      const result = await runUnifiedExecutionPipeline(baseInput(), { enabled: true })
      const memoryStage = result.stages.find((s) => s.stageId === 'memory')
      expect(memoryStage).toBeTruthy()
      expect(['completed', 'recovered', 'skipped']).toContain(memoryStage!.status)
      expect(result.memory).toBeTruthy()
    })
  })

  describe('provider timeout', () => {
    it('recovers from stage timeout when continueOnWarning', async () => {
      const adapters: PipelineStageAdapters = {
        flight_search: async () => {
          await new Promise((r) => setTimeout(r, 50))
          return okStage('flight_search', { delayed: true })
        },
      }
      const result = await runUnifiedExecutionPipeline(baseInput(), {
        enabled: true,
        adapters,
        stageTimeoutMs: 5,
        continueOnWarning: true,
        maxRetries: 0,
      })
      const flightStage = result.stages.find((s) => s.stageId === 'flight_search')
      expect(flightStage?.status).toBe('recovered')
      expect(result.partial).toBe(true)
      expect(result.metrics.stagesRecovered).toBeGreaterThanOrEqual(1)
    })
  })

  describe('flight / hotel unavailable', () => {
    it('flight unavailable recovers and continues', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({ flights: [] }),
        { enabled: true },
      )
      const flightStage = result.stages.find((s) => s.stageId === 'flight_search')
      expect(flightStage?.warnings.some((w) => /flight_unavailable/.test(w))).toBe(true)
      expect(result.stages.find((s) => s.stageId === 'final')?.status).toBe('completed')
    })

    it('hotel unavailable recovers and continues', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({ hotels: [] }),
        { enabled: true },
      )
      const hotelStage = result.stages.find((s) => s.stageId === 'hotel_search')
      expect(hotelStage?.warnings.some((w) => /hotel_unavailable/.test(w))).toBe(true)
      expect(result.ok).toBe(true)
    })
  })

  describe('partial pipeline', () => {
    it('skips requested stages and still finishes', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({
          stageOverrides: {
            skipItinerary: true,
            skipConcierge: true,
          },
        }),
        { enabled: true },
      )
      expect(result.stages.find((s) => s.stageId === 'itinerary')?.status).toBe('skipped')
      expect(result.stages.find((s) => s.stageId === 'concierge')?.status).toBe('skipped')
      expect(result.stages.find((s) => s.stageId === 'final')?.status).toBe('completed')
      expect(result.metrics.stagesSkipped).toBeGreaterThanOrEqual(2)
    })
  })

  describe('pipeline metrics', () => {
    it('collects per-stage and aggregate metrics', async () => {
      const result = await runUnifiedExecutionPipeline(baseInput(), { enabled: true })
      expect(result.metrics.pipelineDurationMs).toBeGreaterThanOrEqual(0)
      expect(result.metrics.stagesCompleted + result.metrics.stagesSkipped).toBeGreaterThan(0)
      expect(result.metrics.confidence).toBe(result.confidence)
      const collected = collectPipelineMetrics({
        pipelineDurationMs: 100,
        stages: result.stages,
        confidence: 0.9,
      })
      expect(collected.stagesCompleted).toBeGreaterThanOrEqual(0)
    })
  })

  describe('pipeline logger', () => {
    it('records structured log entries', async () => {
      const entries: Array<{ message: string }> = []
      const runner = createPipelineRunner({
        enabled: true,
        logger: (e) => entries.push(e),
      })
      await runner.run(baseInput())
      expect(entries.some((e) => e.message === 'execution_pipeline.start')).toBe(true)
      expect(entries.some((e) => e.message === 'execution_pipeline.done')).toBe(true)
      expect(runner.getStructuredLogs().length).toBeGreaterThan(0)

      const logger = createPipelineLogger()
      logger.info('test')
      expect(logger.messages()).toContain('test')
    })
  })

  describe('recovery', () => {
    it('retries then recovers failed stage', async () => {
      let attempts = 0
      const adapters: PipelineStageAdapters = {
        decision: () => {
          attempts += 1
          if (attempts < 2) {
            return createFailedStageResult('decision', 'transient', 1, true)
          }
          return okStage('decision', { recovered: true }, 0.7)
        },
      }
      const result = await runUnifiedExecutionPipeline(baseInput(), {
        enabled: true,
        adapters,
        maxRetries: 2,
        continueOnWarning: true,
      })
      expect(attempts).toBeGreaterThanOrEqual(2)
      const decision = result.stages.find((s) => s.stageId === 'decision')
      expect(decision?.status).toBe('completed')
      expect(result.metrics.retryCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('confidence and metadata propagation', () => {
    it('propagates decision confidence into final response and metadata', async () => {
      const result = await runUnifiedExecutionPipeline(
        baseInput({ decisionConfidence: 0.91, decisionExplanation: 'Strong match' }),
        { enabled: true },
      )
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.finalResponse?.confidence).toBe(result.confidence)
      expect(result.metadata.conversationId).toBe('pipe_115')
      expect(result.metadata.userId).toBe('user_115')
      expect(result.metadata.stageCount).toBe(PIPELINE_STAGE_ORDER.length)
      expect(result.decision?.confidence).toBeTruthy()
    })
  })

  describe('validation', () => {
    it('rejects malformed messages', async () => {
      const validation = validatePipelineInput({
        messages: [{ text: undefined as unknown as string }],
      })
      expect(validation.ok).toBe(false)
      const result = await runUnifiedExecutionPipeline(
        { messages: [{ text: undefined as unknown as string }] },
        { enabled: true },
      )
      expect(result.ok).toBe(false)
      expect(result.validationErrors.length).toBeGreaterThan(0)
    })
  })
})
