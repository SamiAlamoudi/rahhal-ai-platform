/**
 * Sprint 116 — AI Streaming Conversation Experience production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { resetMemoryEngineStores } from '../agent/memory/index'
import {
  createCompletedStageResult,
  createFailedStageResult,
  type PipelineStageAdapters,
} from '../agent/pipeline'
import {
  SPRINT116_STREAMING_CONVERSATION_VERSION,
  STREAMING_CONVERSATION_FEATURE_ID,
  isStreamingConversationEnabled,
  runStreamingConversation,
  createStreamingConversation,
  streamingStageOrder,
  createStreamingTimeline,
  createStreamingEvent,
  collectStreamingMetrics,
  normalizeProgress,
  renderStreamingTranscript,
  type StreamingEvent,
} from '../agent/streaming'

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

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: 'stream_116',
    userId: 'user_116',
    messages: [
      {
        role: 'user' as const,
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
      style: 'leisure' as const,
    },
    flights: [flight('f1', 4200), flight('f2', 3800)],
    hotels: [hotel('h1', 900), hotel('h2', 1400)],
    ...overrides,
  }
}

describe('Sprint 116 — AI Streaming Conversation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT116_STREAMING_CONVERSATION_VERSION).toMatch(/streaming/)
    expect(STREAMING_CONVERSATION_FEATURE_ID).toBe('ai.streaming_conversation')
    expect(getFeatureRegistry().isEnabled('ai.streaming_conversation')).toBe(false)
    expect(isStreamingConversationEnabled()).toBe(false)
  })

  describe('feature OFF/ON', () => {
    it('OFF returns disabled without events', async () => {
      const result = await runStreamingConversation(baseInput())
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.events).toEqual([])
      expect(result.pipeline).toBeNull()
      expect(result.logs).toContain('streaming_conversation_disabled')
    })

    it('ON streams pipeline stages', async () => {
      const result = await runStreamingConversation(baseInput(), { enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.events.length).toBeGreaterThan(0)
      expect(result.events.some((e) => e.kind === 'started')).toBe(true)
      expect(result.events.some((e) => e.kind === 'progress')).toBe(true)
      expect(result.events.some((e) => e.kind === 'completed')).toBe(true)
      expect(result.progressPercent).toBe(100)
      expect(result.pipeline?.enabled).toBe(true)
    })

    it('ON via registry', async () => {
      getFeatureRegistry().setEnabled('ai.streaming_conversation', true)
      const result = await runStreamingConversation(baseInput())
      expect(result.enabled).toBe(true)
      expect(result.events.length).toBeGreaterThan(0)
    })
  })

  describe('simple request', () => {
    it('produces transcript and completes all stages', async () => {
      const result = await runStreamingConversation(baseInput(), { enabled: true })
      expect(result.transcript.length).toBeGreaterThan(0)
      expect(result.transcript.some((l) => /Understanding|✓/.test(l))).toBe(true)
      expect(result.completedStages.length).toBe(streamingStageOrder().length)
      expect(result.remainingStages).toEqual([])
      expect(result.currentStage).toBeNull()
    })
  })

  describe('family / business trip', () => {
    it('family trip streams with family style metadata', async () => {
      const result = await runStreamingConversation(
        baseInput({
          trip: {
            ...baseInput().trip,
            style: 'family',
            children: 2,
          },
          messages: [{ role: 'user', text: 'Family vacation to Japan with kids' }],
        }),
        { enabled: true },
      )
      expect(result.metadata.style).toBe('family')
      expect(result.ok).toBe(true)
    })

    it('business trip streams with business style metadata', async () => {
      const result = await runStreamingConversation(
        baseInput({
          trip: {
            ...baseInput().trip,
            style: 'business',
            cabin: 'business',
          },
          messages: [{ role: 'user', text: 'Business trip to Tokyo' }],
        }),
        { enabled: true },
      )
      expect(result.metadata.style).toBe('business')
      expect(result.events.some((e) => e.stage === 'flight_search')).toBe(true)
    })
  })

  describe('slow providers', () => {
    it('emits progress ticks with progressTickMs', async () => {
      const progressEvents: StreamingEvent[] = []
      const result = await runStreamingConversation(baseInput(), {
        enabled: true,
        progressTickMs: 1,
        progressSteps: [0, 25, 50, 75, 100],
        onEvent: (e) => {
          if (e.kind === 'progress') progressEvents.push(e)
        },
      })
      expect(progressEvents.length).toBeGreaterThan(0)
      expect(result.metrics.progressEvents).toBeGreaterThan(0)
      const steps = new Set(progressEvents.map((e) => e.progressPercent))
      expect(steps.has(25)).toBe(true)
      expect(steps.has(50)).toBe(true)
      expect(steps.has(75)).toBe(true)
    })
  })

  describe('timeouts / errors / warnings', () => {
    it('surfaces errors from failing stage adapters', async () => {
      const adapters: PipelineStageAdapters = {
        flight_search: async () =>
          createFailedStageResult('flight_search', 'provider_timeout', 10, true),
      }
      const result = await runStreamingConversation(baseInput(), {
        enabled: true,
        adapters,
        pipelineOptions: { continueOnWarning: true, maxRetries: 0 },
      })
      expect(result.events.some((e) => e.kind === 'error' || e.kind === 'warning')).toBe(
        true,
      )
      expect(result.warnings.length + result.events.filter((e) => e.kind === 'error').length)
        .toBeGreaterThan(0)
    })

    it('surfaces warnings from stage results', async () => {
      const adapters: PipelineStageAdapters = {
        hotel_search: async () =>
          createCompletedStageResult({
            stageId: 'hotel_search',
            durationMs: 5,
            artifact: { hotelCount: 0 },
            warnings: ['hotel_slow'],
            confidence: 0.4,
            status: 'recovered',
          }),
      }
      const result = await runStreamingConversation(baseInput(), {
        enabled: true,
        adapters,
      })
      expect(result.events.some((e) => e.kind === 'warning')).toBe(true)
      expect(result.warnings.some((w) => /hotel_slow/.test(w))).toBe(true)
    })
  })

  describe('partial execution', () => {
    it('records skipped stages in timeline', async () => {
      const result = await runStreamingConversation(
        baseInput({
          stageOverrides: { skipItinerary: true, skipConcierge: true },
        }),
        { enabled: true },
      )
      expect(result.events.some((e) => e.kind === 'skipped' && e.stage === 'itinerary')).toBe(
        true,
      )
      expect(result.events.some((e) => e.kind === 'skipped' && e.stage === 'concierge')).toBe(
        true,
      )
      expect(result.metadata.partial || result.ok).toBe(true)
    })
  })

  describe('stage ordering and timeline integrity', () => {
    it('starts stages in pipeline order', async () => {
      const result = await runStreamingConversation(baseInput(), { enabled: true })
      const started = result.events
        .filter((e) => e.kind === 'started')
        .map((e) => e.stage)
      const order = streamingStageOrder()
      let lastIdx = -1
      for (const stage of started) {
        const idx = order.indexOf(stage)
        expect(idx).toBeGreaterThan(lastIdx)
        lastIdx = idx
      }
      expect(result.timeline.length).toBe(result.events.length)
      for (let i = 1; i < result.timeline.length; i++) {
        expect(result.timeline[i]!.timestamp).toBeGreaterThanOrEqual(
          result.timeline[i - 1]!.timestamp,
        )
      }
    })

    it('timeline helper stays chronological', () => {
      const tl = createStreamingTimeline()
      const a = createStreamingEvent({
        stage: 'conversation',
        kind: 'started',
        status: 'running',
        message: 'a',
        progressPercent: 0,
        timestamp: 1000,
      })
      const b = createStreamingEvent({
        stage: 'conversation',
        kind: 'completed',
        status: 'completed',
        message: 'b',
        progressPercent: 100,
        timestamp: 1001,
      })
      tl.append(a)
      tl.append(b)
      expect(tl.isChronologicallyIntact()).toBe(true)
      expect(tl.chronological()).toHaveLength(2)
    })
  })

  describe('confidence / metadata / ETA / progress', () => {
    it('propagates confidence and metadata', async () => {
      const result = await runStreamingConversation(
        baseInput({ decisionConfidence: 0.88 }),
        { enabled: true },
      )
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.metadata.conversationId).toBe('stream_116')
      expect(result.metadata.destination).toBe('Japan')
      expect(result.metadata.eventCount).toBe(result.events.length)
      expect(result.pipeline?.confidence).toBeGreaterThan(0)
    })

    it('estimates remaining time during run via progress tracker', async () => {
      const conv = createStreamingConversation({ enabled: true })
      const result = await conv.run(baseInput())
      // After completion ETA is 0
      expect(result.estimatedRemainingTime).toBe(0)
      expect(result.estimatedRemainingTimeMs).toBe(0)
      expect(result.progressPercent).toBe(100)
      expect(normalizeProgress(60)).toBe(50)
      expect(normalizeProgress(90)).toBe(75)
      expect(normalizeProgress(100)).toBe(100)
    })

    it('collects streaming metrics', async () => {
      const result = await runStreamingConversation(baseInput(), { enabled: true })
      const metrics = collectStreamingMetrics({
        events: result.events,
        totalDurationMs: result.latencyMs,
        confidence: result.confidence,
      })
      expect(metrics.stagesStarted).toBeGreaterThan(0)
      expect(metrics.stagesCompleted).toBeGreaterThan(0)
      expect(metrics.eventCount).toBe(result.events.length)
      expect(result.metrics.eventCount).toBe(result.events.length)
    })

    it('renders progressive transcript lines', async () => {
      const result = await runStreamingConversation(baseInput(), { enabled: true })
      const lines = renderStreamingTranscript(result.events)
      expect(lines.some((l) => l.startsWith('✓'))).toBe(true)
      expect(result.transcript).toEqual(lines)
    })
  })
})
