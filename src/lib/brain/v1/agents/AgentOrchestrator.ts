/**
 * Sprint 83 — Agent Orchestrator.
 *
 * RahhalBrain → AgentOrchestrator → registry-selected agents
 * (planner → memory → travel → domain agents → pricing → booking → safety → response)
 *
 * Behind `ai.brain.v1`. No UI / Voice / provider / booking production wiring.
 */

import { emptyBrainV1Entities } from '../types'
import { isBrainV1Enabled } from '../feature'
import { AgentLifecycleTracker } from './AgentLifecycle'
import { AgentRegistry, createAgentRegistry } from './AgentRegistry'
import { DependencyGraph } from './DependencyGraph'
import { createEmptyAgentContextData, DEFAULT_BRAIN_AGENTS } from './definitions'
import {
  classifyError,
  resolveRetryPolicy,
  shouldRetry,
  sleep,
  withTimeout,
} from './RetryPolicy'
import { AgentTelemetryCollector } from './Telemetry'
import {
  BRAIN_AGENT_ORCHESTRATOR_VERSION,
  type BrainAgentContextData,
  type BrainAgentDefinition,
  type BrainAgentId,
  type BrainAgentOrchestratorInput,
  type BrainAgentOrchestratorResult,
  type BrainAgentResult,
  type BrainAgentSelection,
} from './types'

export type AgentOrchestratorDeps = {
  enabled?: boolean
  registry?: AgentRegistry
  /** For tests: force a failure kind on an agent for N attempts. */
  failureInjector?: Partial<Record<BrainAgentId, { kind: 'temporary_failure' | 'timeout' | 'provider_unavailable', failAttempts: number }>>
}

function mergeProviderResults(
  current: BrainAgentContextData['providerResults'],
  incoming: BrainAgentContextData['providerResults'],
): BrainAgentContextData['providerResults'] {
  const map = new Map(current.map((o) => [o.id, o]))
  for (const offer of incoming) map.set(offer.id, offer)
  return [...map.values()]
}

function applyPatch(
  ctx: BrainAgentContextData,
  patch?: Partial<BrainAgentContextData>,
): void {
  if (!patch) return
  if (patch.providerResults) {
    ctx.providerResults = mergeProviderResults(ctx.providerResults, patch.providerResults)
  }
  const rest = { ...patch }
  delete rest.providerResults
  Object.assign(ctx, rest)
}

function cloneContext(ctx: BrainAgentContextData): BrainAgentContextData {
  return {
    ...ctx,
    entities: {
      ...ctx.entities,
      travelDates: { ...ctx.entities.travelDates },
      activities: [...ctx.entities.activities],
    },
    missing: [...ctx.missing],
    tools: [...ctx.tools],
    preferenceMemory: {
      ...ctx.preferenceMemory,
      preferredAirlines: [...ctx.preferenceMemory.preferredAirlines],
    },
    reasoning: [...ctx.reasoning],
    providerResults: [...ctx.providerResults],
    rankedOffers: [...ctx.rankedOffers],
    bookingActions: ctx.bookingActions.map((a) => ({ ...a })),
    safetyNotes: [...ctx.safetyNotes],
    selectedAgents: ctx.selectedAgents.map((s) => ({ ...s })),
    candidateOffers: [...ctx.candidateOffers],
    intent: { ...ctx.intent, secondary: [...ctx.intent.secondary] },
  }
}

export class AgentOrchestrator {
  private readonly registry: AgentRegistry
  private readonly graph = new DependencyGraph()

  constructor(registry?: AgentRegistry) {
    this.registry = registry ?? createAgentRegistry()
  }

  getRegistry(): AgentRegistry {
    return this.registry
  }

  /** Register built-in agents (each definition self-describes; list is not an execution order). */
  registerDefaults(): void {
    for (const agent of DEFAULT_BRAIN_AGENTS) {
      if (!this.registry.has(agent.id)) this.registry.register(agent)
    }
  }

  selectAgents(ctx: BrainAgentContextData): BrainAgentSelection[] {
    const selections: BrainAgentSelection[] = []
    for (const agent of this.registry.list()) {
      if (!agent.shouldSelect(ctx)) continue
      selections.push({
        agentId: agent.id,
        reason: agent.selectionReason(ctx),
      })
    }
    // Planner must always be present if registered.
    if (this.registry.has('planner') && !selections.some((s) => s.agentId === 'planner')) {
      const planner = this.registry.get('planner')!
      selections.unshift({
        agentId: 'planner',
        reason: planner.selectionReason(ctx),
      })
    }
    return selections
  }

  async run(
    input: BrainAgentOrchestratorInput,
    deps: AgentOrchestratorDeps = {},
  ): Promise<BrainAgentOrchestratorResult> {
    if (!isBrainV1Enabled({ enabled: deps.enabled })) {
      return disabledResult()
    }

    const registry = deps.registry ?? this.registry
    if (registry.size() === 0) {
      for (const agent of DEFAULT_BRAIN_AGENTS) registry.register(agent)
    }

    const telemetry = new AgentTelemetryCollector()
    telemetry.start()
    const lifecycle = new AgentLifecycleTracker()
    lifecycle.init(registry.ids())

    const ctx = createEmptyAgentContextData({
      text: input.text,
      locale: input.locale ?? 'ar',
      intent: input.intent ?? {
        intent: input.intentHint ?? 'unknown',
        confidence: input.intentHint ? 0.7 : 0,
        secondary: [],
      },
      entities: input.entities ?? emptyBrainV1Entities(),
      missing: input.missing ?? [],
      tools: input.tools ?? ['none'],
      ...(input.preferenceMemory ? { preferenceMemory: input.preferenceMemory } : {}),
      longTerm: input.longTerm ?? null,
      planner: input.planner ?? null,
      reasoning: input.reasoning ?? [],
      candidateOffers: input.candidateOffers ?? [],
      conversationSummary: input.conversationSummary ?? null,
    })

    const selected = this.selectAgents(ctx)
    ctx.selectedAgents = selected
    telemetry.setPlannerDecisions(selected)

    const selectedIds = selected.map((s) => s.agentId)
    for (const id of selectedIds) lifecycle.markReady(id)

    const defMap = new Map<BrainAgentId, BrainAgentDefinition>()
    for (const id of selectedIds) {
      const def = registry.get(id)
      if (def) defMap.set(id, def)
    }

    const batches = this.graph.buildBatches(selectedIds, defMap)
    telemetry.setParallelBatches(batches)

    // Mark non-ready-batch agents as waiting on dependencies.
    const firstBatch = new Set(batches[0] ?? [])
    for (const id of selectedIds) {
      if (!firstBatch.has(id)) lifecycle.markWaiting(id)
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((agentId) =>
          this.executeAgent(agentId, ctx, lifecycle, telemetry, deps, registry),
        ),
      )
    }

    return {
      version: BRAIN_AGENT_ORCHESTRATOR_VERSION,
      enabled: true,
      context: cloneContext(ctx),
      telemetry: telemetry.snapshot(ctx.tools),
      lifecycleSnapshot: lifecycle.snapshot(),
      selectedAgents: [...ctx.selectedAgents],
      executionOrder: this.graph.flatten(batches),
      parallelBatches: batches,
    }
  }

  private async executeAgent(
    agentId: BrainAgentId,
    ctx: BrainAgentContextData,
    lifecycle: AgentLifecycleTracker,
    telemetry: AgentTelemetryCollector,
    deps: AgentOrchestratorDeps,
    registry: AgentRegistry,
  ): Promise<void> {
    const agent = registry.get(agentId)
    if (!agent) {
      lifecycle.markFailed(agentId)
      return
    }

    const policy = resolveRetryPolicy(agent)
    const event = telemetry.beginEvent(agentId, ctx.tools.filter((t) => t !== 'none'))
    lifecycle.markReady(agentId)
    lifecycle.markExecuting(agentId)

    let attempt = 0
    let lastError: unknown = null
    const injector = deps.failureInjector?.[agentId]

    while (attempt < policy.maxAttempts) {
      attempt += 1
      telemetry.recordAttempt(event)
      try {
        if (injector && attempt <= injector.failAttempts) {
          throw Object.assign(new Error(injector.kind), { failureKind: injector.kind })
        }

        const snapshot = cloneContext(ctx)
        const result = await withTimeout(() => agent.execute(snapshot), policy.timeoutMs)
        applyPatch(ctx, result.patch)
        if (!result.ok) {
          const kind = result.failureKind ?? 'unknown'
          telemetry.recordFailure(event, kind, result.detail)
          if (shouldRetry(policy, kind, attempt)) {
            lifecycle.markRecovering(agentId)
            await sleep(policy.backoffMs)
            lifecycle.markExecuting(agentId)
            continue
          }
          lifecycle.markFailed(agentId)
          telemetry.finishEvent(event, 'failed', false, result.detail)
          await this.tryFallback(agent, ctx, lifecycle, telemetry, deps, registry)
          return
        }

        lifecycle.markCompleted(agentId)
        telemetry.finishEvent(event, 'completed', true, result.detail)
        return
      } catch (err) {
        lastError = err
        const kind = classifyError(err)
        telemetry.recordFailure(event, kind, err instanceof Error ? err.message : 'error')
        if (shouldRetry(policy, kind, attempt)) {
          lifecycle.markRecovering(agentId)
          await sleep(policy.backoffMs)
          lifecycle.markExecuting(agentId)
          continue
        }
        break
      }
    }

    lifecycle.markFailed(agentId)
    telemetry.finishEvent(
      event,
      'failed',
      false,
      lastError instanceof Error ? lastError.message : 'agent failed',
    )
    await this.tryFallback(agent, ctx, lifecycle, telemetry, deps, registry)
  }

  private async tryFallback(
    agent: BrainAgentDefinition,
    ctx: BrainAgentContextData,
    lifecycle: AgentLifecycleTracker,
    telemetry: AgentTelemetryCollector,
    deps: AgentOrchestratorDeps,
    registry: AgentRegistry,
  ): Promise<void> {
    const policy = resolveRetryPolicy(agent)
    const fallbackId = policy.fallbackAgentId
    if (!fallbackId || fallbackId === agent.id) return
    if (!registry.has(fallbackId)) return
    if (lifecycle.get(fallbackId) === 'completed') return
    lifecycle.markRecovering(agent.id)
    await this.executeAgent(fallbackId, ctx, lifecycle, telemetry, deps, registry)
  }
}

function disabledResult(): BrainAgentOrchestratorResult {
  const ctx = createEmptyAgentContextData()
  return {
    version: BRAIN_AGENT_ORCHESTRATOR_VERSION,
    enabled: false,
    context: ctx,
    telemetry: {
      totalDurationMs: 0,
      events: [],
      plannerDecisions: [],
      parallelBatches: [],
      failures: 0,
      retries: 0,
    },
    lifecycleSnapshot: {} as Record<BrainAgentId, import('./types').BrainAgentLifecycle>,
    selectedAgents: [],
    executionOrder: [],
    parallelBatches: [],
  }
}

export async function runBrainAgentOrchestrator(
  input: BrainAgentOrchestratorInput,
  deps: AgentOrchestratorDeps = {},
): Promise<BrainAgentOrchestratorResult> {
  const orchestrator = new AgentOrchestrator(deps.registry)
  if (!deps.registry) orchestrator.registerDefaults()
  return orchestrator.run(input, deps)
}

export function createAgentOrchestrator(registry?: AgentRegistry): AgentOrchestrator {
  const orchestrator = new AgentOrchestrator(registry)
  if (!registry) orchestrator.registerDefaults()
  return orchestrator
}

/** Re-export result type helpers for tests. */
export type { BrainAgentResult }
