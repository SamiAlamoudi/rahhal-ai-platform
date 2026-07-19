/**
 * Sprint 27 — AI Trip Orchestrator tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  AITripOrchestrator,
  buildOrchestratorExecutionPlan,
  clearOrchestratorCache,
  domainsForIntent,
  extractTravelIntentFromConversation,
  getOrCreateAITripOrchestrator,
  getRecentOrchestratorMetrics,
  isBrainTripOrchestratorEnabled,
  resetAITripOrchestrator,
  resetBrainIntegrationSessions,
  resolveOrchestratorDomains,
  runIntegratedBrainPipeline,
  TripPlanningEngine,
} from '../brain'
import { resetBookingFlowController } from '../bookingFlow'
import type { BrainTurnResult } from '../brain/types'

function userMessage(content: string, conversationId = 'c-s27'): ChatMessage {
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

function enableOrchestratorChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
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

describe('Sprint 27 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
  })

  it('registers brain.trip_orchestrator disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('brain.trip_orchestrator')).toBe(false)
    expect(isBrainTripOrchestratorEnabled()).toBe(false)
  })

  it('requires brain.search before brain.trip_orchestrator', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.trip_orchestrator', true)
    expect(registry.isEnabled('brain.trip_orchestrator')).toBe(false)
    enableOrchestratorChain()
    expect(registry.isEnabled('brain.trip_orchestrator')).toBe(true)
    expect(isBrainTripOrchestratorEnabled()).toBe(true)
  })
})

describe('Sprint 27 intent + execution plan', () => {
  it('extracts flight intent from conversation', () => {
    const c = extractTravelIntentFromConversation({
      userText: 'Find flights from Riyadh to Dubai',
      locale: 'en',
    })
    expect(c.intent).toBe('SearchFlights')
    expect(c.confidence).toBeGreaterThan(0.5)
  })

  it('maps intents to domains including ground transport and activities', () => {
    expect(domainsForIntent('SearchFlights')).toEqual(['flights'])
    expect(domainsForIntent('SearchHotels')).toEqual(['hotels'])
    expect(domainsForIntent('SearchPackages')).toEqual([
      'flights',
      'hotels',
      'transport',
      'activities',
      'packages',
    ])
    expect(domainsForIntent('AskRecommendation')).toContain('transport')
    expect(domainsForIntent('AskRecommendation')).toContain('activities')
  })

  it('builds provider-independent execution plan steps', () => {
    const plan = buildOrchestratorExecutionPlan({
      conversationId: 'c1',
      intent: 'SearchPackages',
      confidence: 0.9,
    })
    expect(plan.requestedDomains).toEqual([
      'flights',
      'hotels',
      'transport',
      'activities',
      'packages',
    ])
    expect(plan.domains.every((d) => d.taskType.endsWith('_search'))).toBe(true)
  })

  it('disables non-flight domains for flights_only trip plans', async () => {
    resetBrainIntegrationSessions()
    const tripPlan = await completeTripPlan('c-flights-only')
    tripPlan.notes = 'flights_only'
    if (tripPlan.agentTripPlan) {
      tripPlan.agentTripPlan = {
        ...tripPlan.agentTripPlan,
        requirements: {
          ...tripPlan.agentTripPlan.requirements,
          packageScope: 'flights_only',
        },
      }
    }
    const steps = resolveOrchestratorDomains({
      intent: 'SearchPackages',
      tripPlan,
    })
    expect(steps.find((s) => s.domain === 'flights')?.enabled).toBe(true)
    expect(steps.find((s) => s.domain === 'hotels')?.enabled).toBe(false)
    expect(steps.find((s) => s.domain === 'packages')?.enabled).toBe(false)
  })
})

describe('Sprint 27 AITripOrchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetBookingFlowController()
    clearOrchestratorCache()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetBookingFlowController()
  })

  it('returns disabled error when flag is OFF', async () => {
    const orch = AITripOrchestrator({ enabled: false })
    const result = await orch.runTurn({
      conversationId: 'c-off',
      userText: 'Plan a trip to Dubai',
      locale: 'en',
    })
    expect(result.error).toBe('trip_orchestrator_disabled')
    expect(result.brain).toBeNull()
  })

  it('runs pipeline and aggregates search via mock providers', async () => {
    enableOrchestratorChain()
    await completeTripPlan('c-orch')
    const orch = AITripOrchestrator({
      enabled: true,
      bookingFlow: false,
      cacheTtlMs: 0,
    })
    const result = await orch.runTurn({
      conversationId: 'c-orch',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
      locale: 'en',
      bypassCache: true,
    })
    expect(result.error).toBeNull()
    expect(result.executionPlan.requestedDomains.length).toBeGreaterThan(0)
    expect(result.metrics.success).toBe(true)
    expect(result.logs.length).toBeGreaterThan(0)
    expect(result.logs.some((l) => l.stage === 'intent')).toBe(true)
    const brain = result.brain as BrainTurnResult
    expect(brain.search).toBeTruthy()
    expect(result.aggregated.hasSearch).toBe(true)
    expect(result.metrics.providerCalls).toBeGreaterThan(0)
  })

  it('retries on transient pipeline failure then succeeds', async () => {
    enableOrchestratorChain()
    let calls = 0
    const orch = AITripOrchestrator({
      enabled: true,
      bookingFlow: false,
      maxRetries: 2,
      cacheTtlMs: 0,
      runPipeline: async (input) => {
        calls += 1
        if (calls === 1) throw new Error('transient_provider_error')
        return runIntegratedBrainPipeline(input)
      },
    })
    await completeTripPlan('c-retry')
    const result = await orch.runTurn({
      conversationId: 'c-retry',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
      locale: 'en',
      bypassCache: true,
    })
    expect(calls).toBe(2)
    expect(result.metrics.retries).toBe(1)
    expect(result.error).toBeNull()
    expect(result.aggregated.hasSearch).toBe(true)
  })

  it('records timeout metrics when pipeline aborts', async () => {
    enableOrchestratorChain()
    const orch = AITripOrchestrator({
      enabled: true,
      bookingFlow: false,
      maxRetries: 0,
      timeoutMs: 20,
      cacheTtlMs: 0,
      runPipeline: async () => {
        await new Promise((r) => setTimeout(r, 80))
        throw new DOMException('Aborted', 'AbortError')
      },
    })
    const result = await orch.runTurn({
      conversationId: 'c-timeout',
      userText: 'flights to Dubai',
      locale: 'en',
      bypassCache: true,
    })
    expect(result.error).toBe('timeout_or_aborted')
    expect(result.metrics.timeouts).toBeGreaterThanOrEqual(1)
    expect(result.stage).toBe('cancelled')
  })

  it('caches successful complete turns', async () => {
    enableOrchestratorChain()
    await completeTripPlan('c-cache')
    const orch = AITripOrchestrator({
      enabled: true,
      bookingFlow: false,
      cacheTtlMs: 60_000,
    })
    const input = {
      conversationId: 'c-cache',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
      locale: 'en' as const,
    }
    const first = await orch.runTurn(input)
    expect(first.cacheHit).toBe(false)
    expect(first.stage).toBe('complete')
    const second = await orch.runTurn(input)
    expect(second.cacheHit).toBe(true)
    expect(second.aggregated.hasSearch).toBe(true)
  })

  it('attaches booking flow when enabled', async () => {
    enableOrchestratorChain()
    getFeatureRegistry().setEnabled('ui.booking_flow', true)
    await completeTripPlan('c-book')
    const orch = AITripOrchestrator({
      enabled: true,
      bookingFlow: true,
      cacheTtlMs: 0,
    })
    const result = await orch.runTurn({
      conversationId: 'c-book',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
      locale: 'en',
      userId: 'u-book',
      bypassCache: true,
    })
    expect(result.bookingFlowId).toBeTruthy()
    expect(result.aggregated.hasBookingFlow).toBe(true)
    expect(result.bookingFlowStage).toBeTruthy()
  })

  it('records execution metrics for inspection', async () => {
    enableOrchestratorChain()
    await completeTripPlan('c-metrics')
    const orch = getOrCreateAITripOrchestrator('metrics', {
      enabled: true,
      bookingFlow: false,
      cacheTtlMs: 0,
    })
    await orch.runTurn({
      conversationId: 'c-metrics',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
      locale: 'en',
      bypassCache: true,
    })
    const recent = getRecentOrchestratorMetrics()
    expect(recent.length).toBeGreaterThan(0)
    expect(recent[0]?.conversationId).toBe('c-metrics')
  })
})

describe('Sprint 27 agent integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetBookingFlowController()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetBookingFlowController()
  })

  it('keeps planTurn unchanged when trip_orchestrator is OFF', async () => {
    enableOrchestratorChain()
    getFeatureRegistry().setEnabled('brain.trip_orchestrator', false)
    const agent = createTravelAgentService({
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainTripPlanningEnabled: true,
      brainExecutionEnabled: true,
      brainSearchEnabled: true,
      brainTripOrchestratorEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'c-compat',
      messages: [
        userMessage(
          'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
          'c-compat',
        ),
      ],
    })
    expect(turn.meta.brain?.orchestrator).toBeFalsy()
    expect(turn.meta.brain?.search || turn.meta.brain?.clarificationQuestion).toBeTruthy()
  })

  it('attaches orchestrator meta when flag chain is ON', async () => {
    enableOrchestratorChain()
    const agent = createTravelAgentService({
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainTripPlanningEnabled: true,
      brainExecutionEnabled: true,
      brainSearchEnabled: true,
      brainTripOrchestratorEnabled: true,
    })
    // Seed planning session via orchestrator path across turns
    const cid = 'c-agent-orch'
    let messages = [
      userMessage(
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
        cid,
      ),
    ]
    let turn = await agent.planTurn({ conversationId: cid, messages })
    let guard = 0
    while (turn.meta.brain?.clarificationQuestion && guard < 5) {
      guard += 1
      messages = [
        ...messages,
        {
          ...userMessage('assistant placeholder', cid),
          role: 'assistant',
          content: String(turn.meta.brain.clarificationQuestion),
          id: `a-${guard}`,
        },
        userMessage('5 days with 2 adults from Riyadh', cid),
      ]
      turn = await agent.planTurn({ conversationId: cid, messages })
    }
    expect(turn.meta.brain?.orchestrator).toBeTruthy()
    const orch = turn.meta.brain?.orchestrator as { metrics?: { success?: boolean } }
    expect(orch?.metrics?.success).toBe(true)
  })

  it('does not invent a second search engine — reuses brain.search', async () => {
    enableOrchestratorChain()
    const spy = vi.spyOn(await import('../brain/search'), 'aggregateSearch')
    const orch = AITripOrchestrator({
      enabled: true,
      bookingFlow: false,
      cacheTtlMs: 0,
    })
    await completeTripPlan('c-reuse')
    await orch.runTurn({
      conversationId: 'c-reuse',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 5 days, budget 8000 SAR, Saudia, resort hotel',
      locale: 'en',
      bypassCache: true,
    })
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    spy.mockRestore()
  })
})
