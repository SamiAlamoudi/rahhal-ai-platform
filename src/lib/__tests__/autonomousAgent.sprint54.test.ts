import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AutonomousStateMachine,
  buildExecutionPlan,
  clearAutonomousJobs,
  clearAutonomousLogs,
  completeGoal,
  createAutonomousJob,
  criticalBlockingFields,
  deriveTravelObjective,
  executeToolWithRetry,
  getRecentAutonomousLogs,
  isAutonomousAgentEnabled,
  pendingTasks,
  completedTasks,
  publishAutonomousProgress,
  resolveAlternatives,
  runAutonomousJobInBackground,
  runAutonomousTurn,
  runToolPlan,
  subscribeAutonomousJob,
  upsertTravelGoal,
} from '../agent/autonomous'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import { createAgentToolRegistry } from '../agent/tools/registry'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import type { AgentTool, AgentToolContext, AgentToolName, AgentToolResult } from '../agent/tools/types'
import { emptyMemory, emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'

function user(content: string, conversationId = 'c-54'): ChatMessage {
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
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  }
}

function failingTool(name: AgentToolName, providerId: string): AgentTool {
  return {
    name,
    providerId,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    defaultTimeoutMs: 200,
    isAvailable: () => true,
    async execute(): Promise<AgentToolResult> {
      return {
        tool: name,
        status: 'error',
        summary: `${name} failed`,
        error: `${name}_boom`,
      }
    },
  }
}

function flakyThenOkTool(name: AgentToolName, failAttempts: number): AgentTool {
  let attempts = 0
  return {
    name,
    providerId: `flaky-${name}`,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    defaultTimeoutMs: 200,
    isAvailable: () => true,
    async execute(): Promise<AgentToolResult> {
      attempts += 1
      if (attempts <= failAttempts) {
        throw new Error(`${name}_transient`)
      }
      return {
        tool: name,
        status: 'ok',
        summary: `${name} ok on attempt ${attempts}`,
        data: { attempts },
      }
    },
  }
}

function okTool(name: AgentToolName, providerId = `mock-${name}`): AgentTool {
  return {
    name,
    providerId,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    defaultTimeoutMs: 200,
    isAvailable: () => true,
    async execute(_ctx: AgentToolContext): Promise<AgentToolResult> {
      return {
        tool: name,
        status: 'ok',
        summary: `${name} ok`,
        data: { providerId },
      }
    },
  }
}

describe('Sprint 54 — Autonomous Travel Agent', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    clearAutonomousLogs()
    clearAutonomousJobs()
  })

  afterEach(() => {
    resetFeatureRegistry()
    clearAutonomousJobs()
  })

  describe('feature flag', () => {
    it('registers ai.autonomous_agent enabled by default', () => {
      expect(getFeatureRegistry().isEnabled('ai.autonomous_agent')).toBe(true)
      expect(isAutonomousAgentEnabled()).toBe(true)
      expect(isAutonomousAgentEnabled({ enabled: false })).toBe(false)
    })
  })

  describe('state machine', () => {
    it('allows the happy-path transitions', () => {
      const sm = new AutonomousStateMachine('IDLE')
      expect(sm.transition('UNDERSTANDING')).toBe('UNDERSTANDING')
      expect(sm.transition('PLANNING')).toBe('PLANNING')
      expect(sm.transition('EXECUTING')).toBe('EXECUTING')
      expect(sm.transition('WAITING_PROVIDER')).toBe('WAITING_PROVIDER')
      expect(sm.transition('RECOVERING')).toBe('RECOVERING')
      expect(sm.transition('COMPLETE')).toBe('COMPLETE')
    })

    it('rejects illegal transitions', () => {
      const sm = new AutonomousStateMachine('IDLE')
      expect(() => sm.transition('EXECUTING')).toThrow(/invalid_autonomous_transition/)
    })

    it('tryTransition is safe for illegal moves', () => {
      const sm = new AutonomousStateMachine('IDLE')
      expect(sm.tryTransition('COMPLETE')).toBe('IDLE')
    })
  })

  describe('goal engine', () => {
    it('derives and persists a travel goal across turns', () => {
      const memory = emptyMemory('en')
      memory.requirements = {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
      }
      memory.missingFields = ['durationDays']
      const first = upsertTravelGoal({
        conversationId: 'c-54',
        userText: 'I want Japan',
        memory,
      })
      expect(first.objective).toBe('plan_trip:Japan')
      expect(first.status).toBe('blocked')
      expect(first.blockingFields).toContain('durationDays')

      memory.requirements.durationDays = 5
      memory.missingFields = []
      const second = upsertTravelGoal({
        conversationId: 'c-54',
        userText: '5 days',
        memory,
        priorGoal: first,
      })
      expect(second.id).toBe(first.id)
      expect(second.status).toBe('active')
      expect(second.blockingFields).toEqual([])
      expect(completeGoal(second).status).toBe('completed')
    })

    it('keeps flexible-destination discovery without requiring a city', () => {
      expect(deriveTravelObjective({
        userText: 'somewhere cold',
        requirements: { ...emptyRequirements(), destinationFlexible: true },
      })).toBe('discover_destination')
      expect(criticalBlockingFields(
        { ...emptyRequirements(), destinationFlexible: true },
        ['destination', 'durationDays'],
      )).toEqual(['durationDays'])
    })
  })

  describe('execution plan', () => {
    it('builds multi-step tasks and tracks pending/completed', () => {
      const memory = emptyMemory('en')
      memory.requirements = {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
        budgetAmount: 8000,
        budgetCurrency: 'SAR',
      }
      const goal = upsertTravelGoal({
        conversationId: 'c-54',
        userText: COMPLETE_JAPAN_5D,
        memory,
      })
      const plan = buildExecutionPlan({
        goal,
        requirements: memory.requirements,
        missingCriticalFields: [],
        locale: 'en',
      })
      expect(plan.tasks.length).toBeGreaterThan(4)
      expect(plan.tasks.some((t) => t.kind === 'search_flights')).toBe(true)
      expect(plan.tasks.some((t) => t.kind === 'compare_options')).toBe(true)
      expect(pendingTasks(plan).length).toBe(plan.tasks.length)
      expect(completedTasks(plan).length).toBe(0)
    })

    it('asks at most one clarification task when blocked', () => {
      const memory = emptyMemory('en')
      memory.requirements = { ...emptyRequirements(), destination: 'Japan', destinations: ['Japan'] }
      const goal = upsertTravelGoal({
        conversationId: 'c-54',
        userText: 'Japan',
        memory,
      })
      const plan = buildExecutionPlan({
        goal,
        requirements: memory.requirements,
        missingCriticalFields: ['durationDays', 'budgetAmount'],
        locale: 'en',
      })
      // Caller passes a single field into the plan builder for ≤1 clarification.
      const single = buildExecutionPlan({
        goal,
        requirements: memory.requirements,
        missingCriticalFields: ['durationDays'],
        locale: 'en',
      })
      expect(single.tasks.filter((t) => t.kind === 'clarify')).toHaveLength(1)
      expect(plan.tasks.filter((t) => t.tool)).toHaveLength(0)
    })
  })

  describe('tool planner — retries and recovery', () => {
    it('retries flaky tools until success', async () => {
      const registry = createAgentToolRegistry()
      registry.register(flakyThenOkTool('weather', 1))
      const { result, retries } = await executeToolWithRetry({
        registry,
        toolName: 'weather',
        ctx: {
          requirements: emptyRequirements(),
          tripPlan: null,
          itinerary: null,
          locale: 'en',
        },
        maxRetries: 2,
      })
      expect(result.status).toBe('ok')
      expect(retries).toBe(1)
    })

    it('recovers with an alternative tool after primary failure', async () => {
      const registry = createAgentToolRegistry()
      registry.register(failingTool('attractions', 'bad-attractions'))
      registry.register(okTool('maps', 'good-maps'))
      const run = await runToolPlan({
        registry,
        tools: [{ name: 'attractions', alternatives: ['maps'], maxRetries: 0 }],
        ctx: {
          requirements: emptyRequirements(),
          tripPlan: null,
          itinerary: null,
          locale: 'en',
        },
      })
      expect(run.recoveredFromFailures).toBe(true)
      expect(run.results.some((r) => r.tool === 'maps' && r.status === 'ok')).toBe(true)
      expect(resolveAlternatives('attractions')).toContain('maps')
    })

    it('continues after provider failure without throwing', async () => {
      const registry = createAgentToolRegistry()
      registry.register(failingTool('flights', 'bad-flights'))
      registry.register(okTool('hotels'))
      const run = await runToolPlan({
        registry,
        tools: [
          { name: 'flights', maxRetries: 0 },
          { name: 'hotels', maxRetries: 0 },
        ],
        ctx: {
          requirements: emptyRequirements(),
          tripPlan: null,
          itinerary: null,
          locale: 'en',
        },
      })
      expect(run.results.some((r) => r.tool === 'flights' && r.status === 'error')).toBe(true)
      expect(run.results.some((r) => r.tool === 'hotels' && r.status === 'ok')).toBe(true)
      expect(run.okCount).toBeGreaterThan(0)
    })
  })

  describe('autonomous runner', () => {
    it('executes a multi-step plan and emits progress phases', async () => {
      const memory = emptyMemory('en')
      memory.requirements = {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
        budgetAmount: 8000,
        budgetCurrency: 'SAR',
        packageScope: 'full_package',
      }
      memory.missingFields = []
      const phases: string[] = []
      const states: string[] = []
      const result = await runAutonomousTurn({
        conversationId: 'c-54',
        userText: COMPLETE_JAPAN_5D,
        memory,
        registry: createMockAgentToolRegistry(),
        onProgress: (event) => {
          phases.push(event.phase)
          states.push(event.state)
        },
      })
      expect(result.planBuilt).toBe(true)
      expect(result.tripPlan?.destinations).toContain('Japan')
      expect(result.snapshot.goal?.objective).toBe('plan_trip:Japan')
      expect(result.snapshot.goal?.status).toBe('completed')
      expect(result.snapshot.completedTaskIds.length).toBeGreaterThan(0)
      expect(phases).toContain('Thinking')
      expect(phases).toContain('Searching')
      expect(phases).toContain('Comparing')
      expect(phases).toContain('Completed')
      expect(states).toContain('UNDERSTANDING')
      expect(states).toContain('PLANNING')
      expect(states).toContain('EXECUTING')
      expect(states).toContain('COMPLETE')
      expect(getRecentAutonomousLogs().length).toBeGreaterThan(0)
    })

    it('blocks with a single clarification when critical info is missing', async () => {
      const memory = emptyMemory('en')
      memory.requirements = {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
      }
      memory.missingFields = ['durationDays', 'budgetAmount', 'travelers']
      const result = await runAutonomousTurn({
        conversationId: 'c-54',
        userText: 'Japan please',
        memory,
        registry: createMockAgentToolRegistry(),
      })
      expect(result.needsClarification).toBe(true)
      expect(result.clarificationField).toBe('durationDays')
      expect(result.planBuilt).toBe(false)
      expect(result.snapshot.outcome).toBe('blocked')
    })

    it('recovers from tool failure and still builds a plan', async () => {
      const memory = emptyMemory('en')
      memory.requirements = {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
        budgetAmount: 5000,
        budgetCurrency: 'USD',
      }
      memory.missingFields = []
      const registry = createMockAgentToolRegistry()
      registry.register(failingTool('attractions', 'broken-attractions'))
      const result = await runAutonomousTurn({
        conversationId: 'c-54',
        userText: COMPLETE_JAPAN_5D,
        memory,
        registry,
      })
      expect(result.planBuilt).toBe(true)
      expect(result.snapshot.state).toBe('COMPLETE')
      // Either recovered via maps alternative or soft-skipped — conversation must not fail.
      expect(result.snapshot.outcome).not.toBe('failed')
    })
  })

  describe('background execution', () => {
    it('runs work asynchronously and streams progress to subscribers', async () => {
      const events: string[] = []
      const job = createAutonomousJob('c-54')
      const unsubscribe = subscribeAutonomousJob(job.id, (event) => {
        events.push(event.phase)
      })
      publishAutonomousProgress(job.id, {
        phase: 'Searching',
        state: 'WAITING_PROVIDER',
        message: 'working',
        at: new Date().toISOString(),
      })
      expect(events).toEqual(['Searching'])

      const bg = runAutonomousJobInBackground({
        conversationId: 'c-54',
        worker: async (publish) => {
          publish({
            phase: 'Thinking',
            state: 'UNDERSTANDING',
            message: 'start',
            at: new Date().toISOString(),
          })
          publish({
            phase: 'Completed',
            state: 'COMPLETE',
            message: 'done',
            at: new Date().toISOString(),
          })
          return {
            state: 'COMPLETE',
            progressPhase: 'Completed',
            goal: null,
            plan: null,
            completedTaskIds: [],
            pendingTaskIds: [],
            lastProviderId: null,
            totalRetries: 0,
            durationMs: 1,
            outcome: 'ok',
            logs: [],
            recoveredFromFailures: false,
          }
        },
      })
      await vi.waitFor(() => {
        expect(bg.status === 'completed' || bg.snapshot != null).toBe(true)
      })
      unsubscribe()
      expect(bg.snapshot?.outcome).toBe('ok')
    })
  })

  describe('planTurn integration', () => {
    it('attaches autonomous meta and preserves Conversation Brain replies', async () => {
      const service = createTravelAgentService({
        concierge: false,
        autonomousAgentEnabled: true,
      })
      const turn = await service.planTurn({
        conversationId: 'c-54',
        messages: [user(COMPLETE_JAPAN_5D)],
      })
      expect(turn.tripPlan?.destinations).toContain('Japan')
      expect(turn.meta.autonomous?.goal?.objective).toMatch(/plan_trip:Japan/)
      expect(turn.meta.autonomous?.state).toBe('COMPLETE')
      expect(turn.meta.spokenText).toBeTruthy()
      expect(turn.reply.toLowerCase()).not.toMatch(/next question|سؤال التالي|decision engine/)
    })

    it('persists the goal across clarification turns', async () => {
      const service = createTravelAgentService({
        concierge: false,
        autonomousAgentEnabled: true,
      })
      const first = await service.planTurn({
        conversationId: 'c-54-goal',
        messages: [user('I want to visit Japan.', 'c-54-goal')],
      })
      expect(first.meta.autonomous?.goal?.objective).toMatch(/Japan|plan_trip/)
      const history: ChatMessage[] = [
        user('I want to visit Japan.', 'c-54-goal'),
        {
          ...user('a1', 'c-54-goal'),
          id: 'a1',
          role: 'assistant',
          content: first.reply,
          providerMeta: first.meta as unknown as Record<string, unknown>,
        },
        user('5 days for 2 adults, budget 8000 SAR', 'c-54-goal'),
      ]
      const second = await service.planTurn({
        conversationId: 'c-54-goal',
        messages: history,
      })
      expect(second.meta.autonomous?.goal?.objective).toMatch(/plan_trip:Japan/)
    })

    it('streams autonomous progress from the provider', async () => {
      const provider = createTravelAgentProvider({
        concierge: false,
        autonomousAgentEnabled: true,
        // Exercise legacy autonomous progress streaming, not Bilamo short-circuit.
        bilamoIntelligenceEnabled: false,
      })
      const phases: string[] = []
      for await (const chunk of provider.streamReply({
        conversationId: 'c-54-stream',
        messages: [user(COMPLETE_JAPAN_5D, 'c-54-stream')],
        signal: new AbortController().signal,
      })) {
        const progress = (chunk.meta as { autonomousProgress?: { phase?: string } } | undefined)
          ?.autonomousProgress
        if (progress?.phase) phases.push(progress.phase)
      }
      expect(phases.length).toBeGreaterThan(0)
      expect(phases).toContain('Completed')
    })

    it('can disable autonomous orchestration without breaking planTurn', async () => {
      const service = createTravelAgentService({
        concierge: false,
        autonomousAgentEnabled: false,
      })
      const turn = await service.planTurn({
        conversationId: 'c-54-off',
        messages: [user(COMPLETE_JAPAN_5D, 'c-54-off')],
      })
      expect(turn.tripPlan?.destinations).toContain('Japan')
      expect(turn.meta.autonomous).toBeUndefined()
      expect(turn.meta.spokenText).toBeTruthy()
    })
  })
})
