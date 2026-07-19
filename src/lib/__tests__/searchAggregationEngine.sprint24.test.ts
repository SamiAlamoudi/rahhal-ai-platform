/**
 * Sprint 24 — Search Aggregation Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  TripPlanningEngine,
  TravelExecutionEngine,
  aggregateSearch,
  buildSearchRecommendation,
  deduplicateOptions,
  isBrainSearchEnabled,
  normalizeExecutionResults,
  rankAndScoreOptions,
  resetBrainIntegrationSessions,
  resetTravelExecutionSessions,
  resetTripPlanningSessions,
  runIntegratedBrainPipeline,
  type FlightOption,
  type SearchAggregationTurnResult,
  type SearchOption,
} from '../brain'
import type { ExecutionResult } from '../brain/execution'
import { createMockVoiceProvider, createVoiceSession } from '../voiceConversation'

function userMessage(content: string, conversationId = 'c-s24'): ChatMessage {
  const now = '2026-07-19T00:00:00.000Z'
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

async function completeTripPlan(conversationId: string) {
  const planner = TripPlanningEngine({ conversationId, locale: 'en' })
  let result = planner.runTurn({
    userText:
      'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
  })
  let guard = 0
  while (result.stage === 'clarify' && guard < 5) {
    guard += 1
    const field = result.clarification.field
    const answer =
      field === 'travelDates'
        ? 'for 5 days'
        : field === 'travelerCount'
          ? '2 adults'
          : field === 'departureCity'
            ? 'from Riyadh'
            : '5 days with 2 adults from Riyadh'
    result = planner.runTurn({ userText: answer })
  }
  expect(result.tripPlan?.status).toBe('complete')
  return result.tripPlan!
}

function flightOption(overrides: Partial<FlightOption> = {}): FlightOption {
  return {
    id: 'f1',
    kind: 'flight',
    from: 'RUH',
    to: 'DXB',
    airline: 'Saudia',
    cabin: 'economy',
    price: 1200,
    currency: 'SAR',
    stops: 0,
    durationHours: 2.5,
    providerId: 'mock_flights',
    sourceTaskId: 'task_flight',
    ...overrides,
  }
}

function sampleResults(): ExecutionResult[] {
  return [
    {
      taskId: 't_flight',
      type: 'flight_search',
      status: 'completed',
      success: true,
      durationMs: 10,
      retryCount: 0,
      providerId: 'mock_flights',
      error: null,
      data: {
        kind: 'flights',
        mock: true,
        offers: [
          {
            id: 'fl_a',
            from: 'RUH',
            to: 'DXB',
            airline: 'Saudia',
            cabin: 'economy',
            price: 1100,
            currency: 'SAR',
            stops: 0,
          },
          {
            id: 'fl_b',
            from: 'RUH',
            to: 'DXB',
            airline: 'Flynas',
            cabin: 'economy',
            price: 900,
            currency: 'SAR',
            stops: 1,
          },
        ],
      },
    },
    {
      taskId: 't_hotel',
      type: 'hotel_search',
      status: 'completed',
      success: true,
      durationMs: 12,
      retryCount: 0,
      providerId: 'mock_hotels',
      error: null,
      data: {
        kind: 'hotels',
        mock: true,
        offers: [
          {
            id: 'ht_a',
            name: 'Marina Resort',
            area: 'Dubai Marina',
            stars: 5,
            nightly: 650,
            currency: 'SAR',
          },
        ],
      },
    },
    {
      taskId: 't_transport',
      type: 'transport_search',
      status: 'completed',
      success: true,
      durationMs: 8,
      retryCount: 0,
      providerId: 'mock_transport',
      error: null,
      data: {
        kind: 'transport',
        mock: true,
        offers: [
          {
            id: 'tr_a',
            mode: 'transfer',
            from: 'DXB',
            to: 'Marina',
            price: 120,
            currency: 'SAR',
          },
        ],
      },
    },
    {
      taskId: 't_activities',
      type: 'activities_search',
      status: 'completed',
      success: true,
      durationMs: 9,
      retryCount: 0,
      providerId: 'mock_activities',
      error: null,
      data: {
        kind: 'activities',
        mock: true,
        offers: [
          {
            id: 'ac_a',
            title: 'Desert Safari',
            category: 'adventure',
            price: 350,
            currency: 'SAR',
          },
        ],
      },
    },
    {
      taskId: 't_package',
      type: 'package_search',
      status: 'completed',
      success: true,
      durationMs: 11,
      retryCount: 0,
      providerId: 'mock_packages',
      error: null,
      data: {
        kind: 'packages',
        mock: true,
        offers: [
          {
            id: 'pk_a',
            title: 'Dubai Escape',
            includes: ['flight', 'hotel', 'transfer'],
            price: 4500,
            currency: 'SAR',
          },
        ],
      },
    },
  ]
}

describe('Sprint 24 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('registers brain.search disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('brain.search')).toBe(false)
    expect(isBrainSearchEnabled()).toBe(false)
  })

  it('requires brain.execution before brain.search', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.search', true)
    expect(registry.isEnabled('brain.search')).toBe(false)
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.execution', true)
    expect(registry.isEnabled('brain.search')).toBe(true)
    expect(isBrainSearchEnabled()).toBe(true)
  })
})

describe('Sprint 24 normalize + dedupe', () => {
  it('normalizes all provider payload kinds', () => {
    const options = normalizeExecutionResults(sampleResults())
    expect(options.some((o) => o.kind === 'flight')).toBe(true)
    expect(options.some((o) => o.kind === 'hotel')).toBe(true)
    expect(options.some((o) => o.kind === 'transport')).toBe(true)
    expect(options.some((o) => o.kind === 'activity')).toBe(true)
    expect(options.some((o) => o.kind === 'package')).toBe(true)
    expect(options.length).toBeGreaterThanOrEqual(6)
  })

  it('deduplicates flights keeping lower price', () => {
    const a = flightOption({ id: '1', price: 1500 })
    const b = flightOption({ id: '2', price: 1000 })
    const deduped = deduplicateOptions([a, b])
    expect(deduped).toHaveLength(1)
    expect((deduped[0] as FlightOption).price).toBe(1000)
  })

  it('skips failed execution results', () => {
    const failed: ExecutionResult = {
      taskId: 't_fail',
      type: 'flight_search',
      status: 'failed',
      success: false,
      durationMs: 1,
      retryCount: 1,
      providerId: 'mock',
      error: 'down',
      data: null,
    }
    expect(normalizeExecutionResults([failed])).toEqual([])
  })
})

describe('Sprint 24 ranking + recommendation', () => {
  it('scores with price, stops, duration, budget, preferences, goals', () => {
    const options: SearchOption[] = [
      flightOption({ id: 'cheap', price: 800, stops: 0, airline: 'Saudia' }),
      flightOption({ id: 'pricey', price: 4000, stops: 2, airline: 'OtherAir' }),
    ]
    const ranked = rankAndScoreOptions(options, {
      budgetAmount: 3000,
      preferredAirlines: ['Saudia'],
    })
    expect(ranked[0]?.option.id).toBe('cheap')
    expect(ranked[0]?.factors.price).toBeGreaterThan(ranked[1]?.factors.price ?? 0)
    expect(ranked[0]?.factors.stops).toBeGreaterThan(ranked[1]?.factors.stops ?? 0)
    expect(ranked[0]?.factors.preferenceMatch).toBe(1)
    expect(ranked[0]?.factors.budgetFit).toBeGreaterThan(0)
    expect(ranked[0]?.factors.tripGoals).toBeGreaterThan(0)
  })

  it('ranks hotels by rating and location', () => {
    const options: SearchOption[] = [
      {
        id: 'h1',
        kind: 'hotel',
        name: 'Budget Inn',
        area: 'Outskirts',
        stars: 2,
        nightly: 200,
        currency: 'SAR',
        providerId: 'm',
        sourceTaskId: 't',
      },
      {
        id: 'h2',
        kind: 'hotel',
        name: 'Downtown Resort',
        area: 'Downtown',
        stars: 5,
        nightly: 500,
        currency: 'SAR',
        providerId: 'm',
        sourceTaskId: 't',
      },
    ]
    const ranked = rankAndScoreOptions(options, { budgetAmount: 8000 })
    expect(ranked[0]?.option.id).toBe('h2')
    expect(ranked[0]?.factors.hotelRating).toBeGreaterThan(0.8)
    expect(ranked[0]?.factors.location).toBeGreaterThan(0.8)
  })

  it('builds top, alternatives, rejected, reasoning, confidence', () => {
    const ranked = rankAndScoreOptions(
      [
        flightOption({ id: 'ok', price: 1000 }),
        flightOption({
          id: 'over',
          price: 20000,
          airline: 'ExpensiveAir',
          from: 'JED',
          to: 'CDG',
        }),
      ],
      { budgetAmount: 5000 },
    )
    const rec = buildSearchRecommendation(ranked)
    expect(rec.top).toBeTruthy()
    expect(rec.top?.title).toMatch(/Saudia/)
    expect(Array.isArray(rec.alternatives)).toBe(true)
    expect(rec.rejected.length).toBeGreaterThan(0)
    expect(rec.reasoning.length).toBeGreaterThan(0)
    expect(rec.confidenceScore).toBeGreaterThan(0)
  })
})

describe('Sprint 24 SearchAggregationEngine', () => {
  beforeEach(() => {
    resetTripPlanningSessions()
    resetTravelExecutionSessions()
    resetBrainIntegrationSessions()
  })
  afterEach(() => {
    resetTripPlanningSessions()
    resetTravelExecutionSessions()
    resetBrainIntegrationSessions()
  })

  it('aggregates execution results through full pipeline', async () => {
    const tripPlan = await completeTripPlan('c-agg')
    const execution = await TravelExecutionEngine({
      conversationId: 'c-agg',
    }).execute({ tripPlan })

    const agg = aggregateSearch({
      conversationId: 'c-agg',
      executionPlan: execution.plan,
      executionResults: execution.results,
      tripPlan,
    })

    expect(agg.providerCallCount).toBe(execution.results.length)
    expect(agg.collection.all.length).toBeGreaterThan(0)
    expect(agg.collection.flights.length).toBeGreaterThan(0)
    expect(agg.recommendation.top).toBeTruthy()
    expect(agg.timeline.map((t) => t.stage)).toEqual([
      'provider_results',
      'normalize',
      'deduplicate',
      'ranking',
      'scoring',
      'recommendation',
    ])
    expect(agg.rankedCount).toBe(agg.results.length)
  })

  it('does not attach search when flag is off (backward compatible)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
      brainSearchEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-off-search',
      messages: [userMessage('Plan a trip to Dubai', 'c-off-search')],
    })
    expect(result.meta.brain).toBeUndefined()
  })

  it('runs search aggregation after execution in planTurn', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainTripPlanningEnabled: true,
      brainExecutionEnabled: true,
      brainSearchEnabled: true,
    })
    const conversationId = 'c-plan-search'
    let messages = [
      userMessage(
        'Plan a trip from Jeddah to Paris for 2 adults, 7 days, budget 12000 SAR',
        conversationId,
      ),
    ]
    let result = await service.planTurn({ conversationId, messages })
    let guard = 0
    while (
      result.meta.brain?.clarificationQuestion &&
      (result.meta.brain.planning as { stage?: string } | undefined)?.stage === 'clarify' &&
      guard < 6
    ) {
      guard += 1
      const q = result.meta.brain.clarificationQuestion
      const answer = /depart|city|from/i.test(q)
        ? 'from Jeddah'
        : /when|travel|date|long/i.test(q)
          ? 'for 7 days'
          : /traveler/i.test(q)
            ? '2 adults'
            : '7 days, 2 adults, from Jeddah'
      messages = [
        ...messages,
        {
          ...userMessage('ok', conversationId),
          role: 'assistant',
          id: `a-${guard}`,
          content: q,
        },
        userMessage(answer, conversationId),
      ]
      result = await service.planTurn({ conversationId, messages })
    }

    const search = result.meta.brain?.search as SearchAggregationTurnResult | null | undefined
    if (
      result.meta.brain?.engineTripPlan &&
      (result.meta.brain.engineTripPlan as { status?: string }).status === 'complete'
    ) {
      expect(result.meta.brain?.execution).toBeTruthy()
      expect(search).toBeTruthy()
      expect(search?.recommendation.top).toBeTruthy()
      expect(search?.recommendation.confidenceScore).toBeGreaterThan(0)
      expect(result.meta.brain?.searchRecommendation).toBeTruthy()
      expect(result.meta.brain?.searchCollection).toBeTruthy()
    } else {
      expect(search == null || search === null).toBe(true)
    }
  })

  it('text and voice share the search aggregation pipeline', async () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.execution', true)
    registry.setEnabled('brain.search', true)
    registry.setEnabled('brain.voice', true)

    await completeTripPlan('c-parity-search-text')
    const text = await runIntegratedBrainPipeline({
      conversationId: 'c-parity-search-text',
      userText: 'confirm the Dubai trip plan',
      locale: 'en',
      execution: true,
      tripPlanning: true,
      search: true,
    })
    expect(text.execution).toBeTruthy()
    expect(text.search).toBeTruthy()
    const textSearch = text.search as SearchAggregationTurnResult
    expect(textSearch.recommendation.top).toBeTruthy()
    expect(textSearch.timeline.length).toBe(6)

    await completeTripPlan('c-parity-search-voice')
    const session = createVoiceSession({
      conversationId: 'c-parity-search-voice',
      provider: createMockVoiceProvider(),
    })
    await session.start()
    session.commitUserUtterance('confirm the Dubai trip plan')
    await session.awaitPendingExecution()
    expect(session.getSnapshot().lastBrainPlan).toBeTruthy()
    expect(session.getSnapshot().lastExecution).toBeTruthy()
    expect(session.getSnapshot().lastSearch).toBeTruthy()
    session.dispose()
  })

  it('leaves Sprint 23 behavior intact when only execution is on', async () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.execution', true)
    // brain.search stays OFF

    await completeTripPlan('c-exec-only')
    const result = await runIntegratedBrainPipeline({
      conversationId: 'c-exec-only',
      userText: 'confirm the Dubai trip plan',
      locale: 'en',
      execution: true,
      search: false,
    })
    expect(result.execution).toBeTruthy()
    expect(result.search).toBeNull()
  })
})
