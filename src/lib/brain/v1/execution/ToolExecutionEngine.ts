/**
 * Sprint 85 — Tool Execution Engine.
 *
 * Receives ToolDecisions, resolves order/deps, executes via simulator,
 * merges unified results, and recovers from failures — without modifying
 * existing providers.
 *
 * Behind `ai.brain.v1`. Mock simulator only.
 */

import { isBrainV1Enabled } from '../feature'
import { DependencyResolver } from './DependencyResolver'
import { ExecutionContext } from './ExecutionContext'
import { ExecutionSafety, type SafetyBlock } from './ExecutionSafety'
import { ExecutionSimulator } from './ExecutionSimulator'
import { ExecutionTelemetryCollector } from './ExecutionTelemetry'
import { ResultMerger } from './ResultMerger'
import { ToolExecutor } from './ToolExecutor'
import {
  TOOL_EXECUTION_ENGINE_VERSION,
  type ExecutableToolType,
  type ToolDecision,
  type ToolExecutionRequest,
  type ToolExecutionResponse,
  type UnifiedToolResult,
} from './types'

export type ToolExecutionEngineDeps = {
  enabled?: boolean
  executor?: ToolExecutor
  resolver?: DependencyResolver
  merger?: ResultMerger
  safety?: ExecutionSafety
  simulator?: ExecutionSimulator
}

function disabledResponse(): ToolExecutionResponse {
  const ctx = new ExecutionContext()
  return {
    version: TOOL_EXECUTION_ENGINE_VERSION,
    enabled: false,
    results: [],
    merged: { byTool: {}, items: [], summary: 'ai.brain.v1 disabled' },
    telemetry: ctx.telemetry,
    batches: [],
    cancelled: false,
    safetyBlocks: [{ tool: 'knowledge', reason: 'ai.brain.v1 disabled' }],
    context: ctx.snapshot(),
  }
}

export class ToolExecutionEngine {
  private readonly resolver: DependencyResolver
  private readonly merger: ResultMerger
  private readonly safety: ExecutionSafety
  private readonly simulator: ExecutionSimulator
  private readonly executor: ToolExecutor

  constructor(deps: ToolExecutionEngineDeps = {}) {
    this.resolver = deps.resolver ?? new DependencyResolver()
    this.merger = deps.merger ?? new ResultMerger()
    this.safety = deps.safety ?? new ExecutionSafety()
    this.simulator = deps.simulator ?? new ExecutionSimulator()
    this.executor =
      deps.executor
      ?? new ToolExecutor(this.simulator, this.safety)
  }

  async run(
    request: ToolExecutionRequest,
    deps: { enabled?: boolean } = {},
  ): Promise<ToolExecutionResponse> {
    if (!isBrainV1Enabled({ enabled: deps.enabled })) {
      return disabledResponse()
    }

    const telemetry = new ExecutionTelemetryCollector()
    telemetry.start()

    const ctx = new ExecutionContext({
      conversationSummary: request.conversationSummary,
      memoryNotes: request.memoryNotes,
      travelPlan: request.travelPlan,
      knownSlots: request.knownSlots ?? request.travelPlan?.knownSlots ?? null,
      previousResults: request.previousResults,
      cancellationToken: request.cancellationToken,
    })

    const decisions = this.normalizeDecisions(request.decisions, request.defaultPolicy)
    const batches = this.resolver.buildBatches(decisions)
    telemetry.setBatches(batches)
    ctx.telemetry.parallelBatches = batches.map((b) => [...b])

    const decisionByTool = new Map(decisions.map((d) => [d.tool, d]))
    const results: UnifiedToolResult[] = []
    const safetyBlocks: SafetyBlock[] = []
    const callCounts: Partial<Record<ExecutableToolType, number>> = {}

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (tool) => {
          const decision = decisionByTool.get(tool)
          if (!decision) {
            return {
              tool,
              ok: false,
              status: 'skipped' as const,
              items: [],
              summary: 'Missing decision',
              meta: {
                simulated: true as const,
                source: 'execution_simulator' as const,
                attempts: 0,
              },
            }
          }

          // If already cancelled, still record cancelled outcomes (no simulator work).
          if (ctx.cancellation.cancelled) {
            const event = telemetry.begin(tool, 'cancel')
            telemetry.finish(event, 'cancelled', false)
            return {
              tool,
              ok: false,
              status: 'cancelled' as const,
              items: [],
              summary: `Cancelled: ${ctx.cancellation.reason ?? 'cancel'}`,
              meta: {
                simulated: true as const,
                source: 'execution_simulator' as const,
                attempts: 0,
              },
            }
          }

          const block = this.safety.validateDecision(decision, ctx.knownSlots, {
            availableTools: request.availableTools,
            permissions: request.permissions,
            rateLimits: request.rateLimits,
            callCounts,
          })
          if (block && block.reason !== 'conditional_skip') {
            safetyBlocks.push(block)
          }

          const result = await this.executor.execute(decision, ctx, telemetry, {
            availableTools: request.availableTools,
            permissions: request.permissions,
            rateLimits: request.rateLimits,
            callCounts,
            failureInjector: request.failureInjector,
            enabledFlag: true,
          })

          if (result.status === 'succeeded' || result.status === 'fallback') {
            callCounts[tool] = (callCounts[tool] ?? 0) + 1
          }
          return result
        }),
      )

      // Graceful degradation: always continue with remaining batches.
      results.push(...batchResults)
    }

    const merged = this.merger.merge(results)
    const snap = telemetry.snapshot()
    ctx.telemetry = snap

    return {
      version: TOOL_EXECUTION_ENGINE_VERSION,
      enabled: true,
      results,
      merged,
      telemetry: snap,
      batches,
      cancelled: ctx.cancellation.cancelled,
      safetyBlocks,
      context: ctx.snapshot(),
    }
  }

  cancel(ctx: ExecutionContext, reason?: string): void {
    ctx.cancellation.cancel(reason)
  }

  private normalizeDecisions(
    decisions: ToolDecision[],
    defaultPolicy?: ToolDecision['policy'],
  ): ToolDecision[] {
    return decisions.map((d, index) => ({
      ...d,
      params: { ...d.params },
      policy: d.policy ?? defaultPolicy ?? 'parallel',
      dependsOn: d.dependsOn ? [...d.dependsOn] : undefined,
      priority: d.priority ?? index,
    }))
  }
}

export function createToolExecutionEngine(
  deps?: ToolExecutionEngineDeps,
): ToolExecutionEngine {
  return new ToolExecutionEngine(deps)
}

export async function runToolExecution(
  request: ToolExecutionRequest,
  deps: ToolExecutionEngineDeps = {},
): Promise<ToolExecutionResponse> {
  const engine = createToolExecutionEngine(deps)
  return engine.run(request, { enabled: deps.enabled })
}

/** Helper to build common trip decisions for tests/harness. */
export function buildDefaultTripDecisions(options?: {
  includeBooking?: boolean
}): ToolDecision[] {
  const decisions: ToolDecision[] = [
    {
      tool: 'weather',
      reason: 'Destination weather context',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'maps',
      reason: 'Destination map context',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'visa',
      reason: 'Visa guidance',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'currency',
      reason: 'Currency baseline',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'flights',
      reason: 'Flight search',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'hotels',
      reason: 'Hotel search',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'packages',
      reason: 'Package search',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'pricing',
      reason: 'Price ranking',
      params: {},
      policy: 'sequential',
      dependsOn: ['flights', 'hotels', 'packages'],
    },
    {
      tool: 'calendar',
      reason: 'Travel window',
      params: {},
      policy: 'parallel',
    },
    {
      tool: 'knowledge',
      reason: 'Destination knowledge',
      params: { topic: 'tips' },
      policy: 'parallel',
    },
  ]

  if (options?.includeBooking) {
    decisions.push({
      tool: 'booking',
      reason: 'Prepare booking stub (no execution)',
      params: {},
      policy: 'sequential',
      dependsOn: ['flights', 'hotels', 'pricing'],
    })
  }

  return decisions
}
