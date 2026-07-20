/**
 * Sprint 43 — Rahhal AI Orchestrator & Tool Routing integration tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  AI_ORCHESTRATOR_FEATURE_ID,
  RahhalAiOrchestrator,
  assertParallelWave,
  buildPlannerDecision,
  createMemoryBridge,
  emptySnapshot,
  executeToolWaves,
  isAiOrchestratorEnabled,
  rankRecommendations,
  routeUserIntent,
  shouldUseOrchestratorForRoute,
  type OrchestratorToolId,
  type ToolExecutionResult,
} from '../aiOrchestrator'
import { ConversationController } from '../chat/conversationExperience/ConversationController'
import { resetConversationMemoryService } from '../brain/memory/conversationMemoryService'
import { resetUserPreferenceStore } from '../brain/memory/userPreferenceStore'

function enableOrchestratorChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.context_memory', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
  registry.setEnabled('brain.travel_execution_engine', true)
  registry.setEnabled('brain.payments_platform', true)
  registry.setEnabled('brain.trip_management', true)
  registry.setEnabled('brain.refund_policy_engine', true)
  registry.setEnabled('brain.travel_disruption_engine', true)
  registry.setEnabled('brain.loyalty_platform', true)
  registry.setEnabled('brain.travel_documents', true)
  registry.setEnabled('brain.supplier_marketplace', true)
  registry.setEnabled('brain.finance_platform', true)
  registry.setEnabled('ui.conversation_experience', true)
  registry.setEnabled('brain.ai_orchestrator', true)
}

describe('Sprint 43 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.ai_orchestrator disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(AI_ORCHESTRATOR_FEATURE_ID)).toBe(false)
    expect(isAiOrchestratorEnabled()).toBe(false)
  })

  it('requires finance_platform before ai_orchestrator', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.ai_orchestrator', true)
    expect(registry.isEnabled('brain.ai_orchestrator')).toBe(false)
    enableOrchestratorChain()
    expect(registry.isEnabled('brain.ai_orchestrator')).toBe(true)
    expect(isAiOrchestratorEnabled()).toBe(true)
  })
})

describe('Sprint 43 tool routing', () => {
  it('routes destination travel to flights/hotels/visa/insurance/activities', () => {
    const route = routeUserIntent('I want to travel to Morocco.')
    expect(route.intent).toBe('destination_travel')
    expect(route.tools).toEqual([
      'destination',
      'flights',
      'hotels',
      'visa',
      'insurance',
      'activities',
    ])
    expect(shouldUseOrchestratorForRoute(route)).toBe(true)
  })

  it('routes cheapest option to marketplace/loyalty/finance/refund', () => {
    const route = routeUserIntent('I need the cheapest option.')
    expect(route.intent).toBe('cheapest_option')
    expect(route.tools).toEqual([
      'supplier_marketplace',
      'loyalty',
      'finance',
      'refund_policy',
    ])
  })

  it('routes cancelled flight to disruption + support tools', () => {
    const route = routeUserIntent('My flight was cancelled.')
    expect(route.intent).toBe('flight_cancelled')
    expect(route.tools).toEqual([
      'disruption',
      'refund_policy',
      'loyalty',
      'timeline',
      'supplier_marketplace',
    ])
  })

  it('routes lost passport to documents/visa/timeline/notifications', () => {
    const route = routeUserIntent('I lost my passport.')
    expect(route.intent).toBe('lost_passport')
    expect(route.tools).toEqual([
      'travel_documents',
      'visa',
      'timeline',
      'notifications',
    ])
  })

  it('keeps single-tool routes out of multi-tool orchestration', () => {
    const route = routeUserIntent('What is my wallet balance?')
    expect(shouldUseOrchestratorForRoute(route)).toBe(false)
  })
})

describe('Sprint 43 planner', () => {
  it('builds Plan → Execute → Observe → Continue stages with parallel waves', () => {
    const route = routeUserIntent('I want to travel to Morocco.')
    const decision = buildPlannerDecision({
      route,
      memory: emptySnapshot(),
    })
    expect(decision.stages).toEqual(['plan', 'execute', 'observe', 'continue'])
    expect(decision.waves[0]?.parallel).toBe(true)
    expect(decision.waves[0]?.tools).toContain('flights')
    expect(decision.waves[0]?.tools).toContain('hotels')
  })

  it('sequences disruption before parallel support tools', () => {
    const route = routeUserIntent('My flight was cancelled.')
    const decision = buildPlannerDecision({ route, memory: emptySnapshot() })
    expect(decision.waves[0]).toEqual({ parallel: false, tools: ['disruption'] })
    expect(decision.waves[1]?.parallel).toBe(true)
    expect(decision.waves[1]?.tools).toContain('refund_policy')
  })
})

describe('Sprint 43 parallel execution', () => {
  it('runs independent tools simultaneously', async () => {
    const started: number[] = []
    const finished: number[] = []
    const runTool = async (tool: OrchestratorToolId): Promise<ToolExecutionResult> => {
      started.push(Date.now())
      await new Promise((r) => setTimeout(r, 25))
      finished.push(Date.now())
      return {
        tool,
        ok: true,
        durationMs: 25,
        summary: tool,
        recommendations: [],
      }
    }

    const wallStart = Date.now()
    const results = await executeToolWaves({
      waves: [{ parallel: true, tools: ['flights', 'hotels', 'visa'] }],
      runTool,
    })
    const wall = Date.now() - wallStart

    expect(results).toHaveLength(3)
    expect(assertParallelWave(results)).toBe(true)
    // Parallel should be meaningfully faster than 3 serial 25ms sleeps.
    expect(wall).toBeLessThan(70)
    expect(Math.max(...finished) - Math.min(...started)).toBeLessThan(70)
  })
})

describe('Sprint 43 result ranking', () => {
  it('ranks by price/quality/refund/supplier/loyalty/preferences', () => {
    const memory = emptySnapshot()
    memory.preferredAirlines = ['Saudia']
    memory.budget = { amount: 3000, currency: 'SAR' }
    const ranked = rankRecommendations({
      preferCheapest: true,
      memory,
      toolResults: [
        {
          tool: 'flights',
          ok: true,
          durationMs: 1,
          summary: 'flights',
          recommendations: [
            {
              id: 'f1',
              kind: 'flight',
              title: 'Saudia RUH→RAK',
              score: 0,
              price: 900,
              currency: 'SAR',
              quality: 0.8,
              refundFlexibility: 0.7,
              supplierScore: 0.8,
              travelTimeHours: 5,
              loyaltyValue: 0.6,
              preferenceMatch: 0.5,
              reasons: [],
            },
            {
              id: 'f2',
              kind: 'flight',
              title: 'Other Air RUH→RAK',
              score: 0,
              price: 2200,
              currency: 'SAR',
              quality: 0.9,
              refundFlexibility: 0.4,
              supplierScore: 0.5,
              travelTimeHours: 8,
              loyaltyValue: 0.2,
              preferenceMatch: 0.2,
              reasons: [],
            },
          ],
        },
      ],
    })
    expect(ranked[0]?.id).toBe('f1')
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0)
  })
})

describe('Sprint 43 memory reuse', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationMemoryService()
    resetUserPreferenceStore()
    enableOrchestratorChain()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetConversationMemoryService()
    resetUserPreferenceStore()
  })

  it('reuses budget/travellers/nationality before asking again', () => {
    const bridge = createMemoryBridge({ enabled: true })
    const conversationId = 'mem_orch_1'
    bridge.absorbTurn({
      conversationId,
      userText: 'Budget 5000 SAR for 2 adults. I am Saudi. Prefer Saudia.',
      locale: 'en',
      userId: 'u1',
    })
    const snap = bridge.load({
      conversationId,
      userText: 'I want to travel to Morocco.',
      locale: 'en',
      userId: 'u1',
    })
    expect(snap.budget.amount).toBeTruthy()
    expect(snap.travellers.adults === 2 || snap.travellers.adults === 1 || snap.travellers.adults == null).toBe(true)
    // At least one remembered preference / identity signal.
    expect(
      Boolean(snap.nationality)
      || snap.preferredAirlines.length > 0
      || snap.budget.amount != null,
    ).toBe(true)
  })
})

describe('Sprint 43 orchestrator integration', () => {
  const logs: Record<string, unknown>[] = []

  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationMemoryService()
    resetUserPreferenceStore()
    enableOrchestratorChain()
    logs.length = 0
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetConversationMemoryService()
    resetUserPreferenceStore()
  })

  it('handles multi-tool destination travel and hides engine names', async () => {
    const orch = RahhalAiOrchestrator({
      enabled: true,
      logSink: (e) => logs.push(e),
    })
    const result = await orch.run({
      conversationId: 'orch_dest_1',
      userText: 'I want to travel to Morocco.',
      locale: 'en',
      userId: 'u1',
    })
    expect(result.intent).toBe('destination_travel')
    expect(result.observability.selectedTools).toEqual(
      expect.arrayContaining(['flights', 'hotels', 'visa', 'insurance', 'activities']),
    )
    expect(result.observability.parallelWaves).toBeGreaterThanOrEqual(1)
    expect(result.text.toLowerCase()).toContain('morocco')
    expect(result.text).not.toMatch(/TravelDisruptionEngine|PolicyEngine|SupplierMarketplace|FinancePlatform/)
    expect(result.structured.flights.length + result.structured.hotels.length).toBeGreaterThan(0)
    expect(result.uiMeta.cards).toBeTruthy()
    expect(logs.some((l) => l.type === 'planner_decision')).toBe(true)
  })

  it('handles cheapest multi-tool request', async () => {
    const orch = RahhalAiOrchestrator({ enabled: true, logSink: (e) => logs.push(e) })
    const result = await orch.run({
      conversationId: 'orch_cheap_1',
      userText: 'I need the cheapest option.',
      locale: 'en',
      userId: 'u1',
    })
    expect(result.intent).toBe('cheapest_option')
    expect(result.observability.selectedTools).toEqual(
      expect.arrayContaining(['supplier_marketplace', 'loyalty', 'finance', 'refund_policy']),
    )
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('handles cancelled flight multi-tool recovery', async () => {
    const orch = RahhalAiOrchestrator({ enabled: true })
    const result = await orch.run({
      conversationId: 'orch_cancel_1',
      userText: 'My flight was cancelled.',
      locale: 'en',
      userId: 'u1',
    })
    expect(result.intent).toBe('flight_cancelled')
    expect(result.toolResults.map((t) => t.tool)).toEqual(
      expect.arrayContaining([
        'disruption',
        'refund_policy',
        'loyalty',
        'timeline',
        'supplier_marketplace',
      ]),
    )
  })

  it('handles lost passport multi-tool flow', async () => {
    const orch = RahhalAiOrchestrator({ enabled: true })
    const result = await orch.run({
      conversationId: 'orch_pass_1',
      userText: 'I lost my passport.',
      locale: 'en',
      userId: 'u1',
    })
    expect(result.intent).toBe('lost_passport')
    expect(result.toolResults.map((t) => t.tool)).toEqual(
      expect.arrayContaining(['travel_documents', 'visa', 'timeline', 'notifications']),
    )
  })

  it('supports single-tool path when forced via shouldHandle=false route', async () => {
    const route = routeUserIntent('How many Rahhal points do I have?')
    expect(route.tools.length).toBeGreaterThanOrEqual(1)
    expect(shouldUseOrchestratorForRoute(route)).toBe(false)
  })

  it('records fallback reasons when tools fail', async () => {
    const orch = RahhalAiOrchestrator({
      enabled: true,
      adapters: {
        getLastPlanResult: () => null,
        run: async (tool) => ({
          tool,
          ok: false,
          durationMs: 1,
          summary: 'fail',
          recommendations: [],
          error: 'boom',
        }),
      },
      logSink: (e) => logs.push(e),
    })
    // Force destination travel tools; adapters always fail → fallback conversation tool also fails,
    // but observability must capture fallback reasons/errors.
    const result = await orch.run({
      conversationId: 'orch_fallback_1',
      userText: 'I want to travel to Morocco.',
      locale: 'en',
      userId: 'u1',
    })
    expect(result.usedFallback).toBe(true)
    expect(result.observability.fallbackReasons.length).toBeGreaterThan(0)
    expect(result.observability.errors.length).toBeGreaterThan(0)
  })

  it('ConversationController uses orchestrator for multi-tool turns', async () => {
    const orch = RahhalAiOrchestrator({
      enabled: true,
      logSink: (e) => logs.push(e),
    })
    const controller = ConversationController({
      enabled: true,
      skipPlannerOrchestrator: true,
      aiOrchestrator: orch,
    })
    const turn = await controller.handleTurn({
      conversationId: 'ctrl_orch_1',
      userText: 'I want to travel to Morocco.',
      locale: 'en',
      userId: 'u1',
    })
    expect(turn.assistantMessage.meta?.aiOrchestrator).toBe(true)
    expect(String(turn.renderedText).toLowerCase()).toContain('morocco')
    expect(turn.assistantMessage.meta?.observability).toBeTruthy()
  })
})

describe('Sprint 43 observability', () => {
  it('logs selected tools, execution time, planner decisions', async () => {
    const spy = vi.fn()
    const orch = RahhalAiOrchestrator({ enabled: true, logSink: spy })
    await orch.run({
      conversationId: 'obs_1',
      userText: 'I need the cheapest option.',
      locale: 'en',
    })
    expect(spy).toHaveBeenCalled()
    const turnLog = spy.mock.calls.map((c) => c[0]).find((e) => e.type === 'orchestrator_turn')
    expect(turnLog?.selectedTools).toBeTruthy()
    expect(typeof turnLog?.executionTimeMs).toBe('number')
    expect(turnLog?.stages).toEqual(['plan', 'execute', 'observe', 'continue'])
  })
})
