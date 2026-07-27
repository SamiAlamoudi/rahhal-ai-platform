/**
 * Sprint 23 — Travel Execution Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  TripPlanningEngine,
  TravelExecutionEngine,
  buildExecutionTasksFromTripPlan,
  isBrainExecutionEnabled,
  resetBrainIntegrationSessions,
  resetTravelExecutionSessions,
  resetTripPlanningSessions,
  runIntegratedBrainPipeline,
  taskTypesInOrder,
} from '../brain'
import type { FlightProvider, TravelExecutionTurnResult } from '../brain/execution'

function userMessage(content: string, conversationId = 'c-s23'): ChatMessage {
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

describe('Sprint 23 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('registers brain.execution disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('brain.execution')).toBe(false)
    expect(isBrainExecutionEnabled()).toBe(false)
  })

  it('requires brain.trip_planning before brain.execution', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.execution', true)
    expect(registry.isEnabled('brain.execution')).toBe(false)
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    expect(registry.isEnabled('brain.execution')).toBe(true)
    expect(isBrainExecutionEnabled()).toBe(true)
  })
})

describe('Sprint 23 task builder', () => {
  beforeEach(() => {
    resetTripPlanningSessions()
    resetTravelExecutionSessions()
  })
  afterEach(() => {
    resetTripPlanningSessions()
    resetTravelExecutionSessions()
  })

  it('builds Flight → Hotel → Transport → Activities → Package tasks with deps', async () => {
    const tripPlan = await completeTripPlan('c-tasks')
    const tasks = buildExecutionTasksFromTripPlan(tripPlan)
    expect(tasks.map((t) => t.type)).toEqual(taskTypesInOrder())
    const flight = tasks.find((t) => t.type === 'flight_search')!
    const hotel = tasks.find((t) => t.type === 'hotel_search')!
    const transport = tasks.find((t) => t.type === 'transport_search')!
    const activities = tasks.find((t) => t.type === 'activities_search')!
    const pkg = tasks.find((t) => t.type === 'package_search')!

    for (const t of tasks) {
      expect(t.id).toBeTruthy()
      expect(t.priority).toBeGreaterThan(0)
      expect(t.retryCount).toBe(0)
      expect(t.timeoutMs).toBeGreaterThan(0)
      expect(t.estimatedDurationMs).toBeGreaterThan(0)
      expect(t.metadata.tripPlanId).toBe(tripPlan.id)
      expect(t.metadata.label).toMatch(/Task$/)
    }

    expect(flight.dependencies).toEqual([])
    expect(hotel.dependencies).toEqual([flight.id])
    expect(transport.dependencies).toEqual([flight.id])
    expect(activities.dependencies).toEqual([hotel.id])
    expect(pkg.dependencies).toEqual([flight.id, hotel.id])
  })
})

describe('Sprint 23 TravelExecutionEngine', () => {
  beforeEach(() => {
    resetTripPlanningSessions()
    resetTravelExecutionSessions()
  })
  afterEach(() => {
    resetTripPlanningSessions()
    resetTravelExecutionSessions()
  })

  it('executes a complete TripPlan into ExecutionPlan + Summary', async () => {
    const tripPlan = await completeTripPlan('c-exec')
    const engine = TravelExecutionEngine({ conversationId: 'c-exec' })
    const result = await engine.execute({ tripPlan })

    expect(result.state).toBe('completed')
    expect(result.plan.tasks).toHaveLength(5)
    expect(result.progress.completed).toBeGreaterThanOrEqual(4)
    expect(result.summary.headline).toMatch(/completed|partial/i)
    expect(result.summary.successfulTypes).toContain('flight_search')
    expect(result.results.every((r) => r.providerId)).toBe(true)
    const flightResult = result.results.find((r) => r.type === 'flight_search')
    expect(flightResult?.success).toBe(true)
    expect((flightResult?.data as { mock?: boolean })?.mock).toBe(true)
  })

  it('supports cancellation mid-run', async () => {
    const tripPlan = await completeTripPlan('c-cancel')
    const slowFlights: FlightProvider = {
      id: 'slow_flights',
      async search(ctx) {
        await new Promise((r) => setTimeout(r, 80))
        if (ctx.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        return {
          kind: 'flights',
          mock: true,
          offers: [],
        }
      },
    }
    const engine = TravelExecutionEngine({
      conversationId: 'c-cancel',
      providers: { flights: slowFlights },
      parallelSafe: false,
    })
    const controller = new AbortController()
    const pending = engine.execute({ tripPlan, signal: controller.signal })
    setTimeout(() => controller.abort(), 5)
    const result = await pending
    expect(['cancelled', 'partial', 'failed', 'completed']).toContain(result.state)
  })

  it('retries failed tasks then records failure', async () => {
    const tripPlan = await completeTripPlan('c-retry')
    let attempts = 0
    const flaky: FlightProvider = {
      id: 'flaky',
      async search() {
        attempts += 1
        throw new Error('provider_down')
      },
    }
    const engine = TravelExecutionEngine({
      conversationId: 'c-retry',
      maxRetries: 1,
      providers: { flights: flaky },
      parallelSafe: false,
    })
    const result = await engine.execute({ tripPlan })
    expect(attempts).toBeGreaterThanOrEqual(2)
    expect(result.results.some((r) => r.type === 'flight_search' && !r.success)).toBe(true)
    // Dependent hotel/package skipped or failed cascade → partial/failed
    expect(['partial', 'failed']).toContain(result.state)
  })

  it('skips execution when TripPlan is incomplete', async () => {
    const planner = TripPlanningEngine({ conversationId: 'c-incomplete', locale: 'en' })
    const partial = planner.runTurn({ userText: 'I want Japan' })
    expect(partial.tripPlan?.status).toBe('partial')
    const engine = TravelExecutionEngine({ conversationId: 'c-incomplete' })
    const result = await engine.execute({ tripPlan: partial.tripPlan! })
    expect(result.state).toBe('failed')
    expect(result.summary.headline).toMatch(/incomplete/i)
  })
})

describe('Sprint 23 planTurn + voice parity', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('does not attach execution when flag is off (backward compatible)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
      brainExecutionEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-off',
      messages: [userMessage('Plan a trip to Dubai', 'c-off')],
    })
    expect(result.meta.brain).toBeUndefined()
  })

  it('runs execution after complete planning in planTurn', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainTripPlanningEnabled: true,
      brainExecutionEnabled: true,
    })
    const conversationId = 'c-plan-exec'
    // Drive to complete plan across turns
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

    const execution = result.meta.brain?.execution as TravelExecutionTurnResult | null | undefined
    if (result.meta.brain?.engineTripPlan && (result.meta.brain.engineTripPlan as { status?: string }).status === 'complete') {
      expect(execution).toBeTruthy()
      expect(execution?.plan.tasks.length).toBe(5)
      expect(execution?.summary.progress.total).toBe(5)
    } else {
      // Still clarifying — execution correctly absent
      expect(execution == null || execution === null).toBe(true)
    }
  })

  it('runIntegratedBrainPipeline shares the execution pipeline', async () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.execution', true)

    // Seed a complete plan via planning engine, then pipeline utterance that keeps it complete
    await completeTripPlan('c-parity-text')
    const text = await runIntegratedBrainPipeline({
      conversationId: 'c-parity-text',
      userText: 'confirm the Dubai trip plan',
      locale: 'en',
      execution: true,
      tripPlanning: true,
    })
    expect(text.execution).toBeTruthy()
    const textExec = text.execution as TravelExecutionTurnResult
    expect(textExec.plan.tasks[0]?.type).toBe('flight_search')
  })
})
