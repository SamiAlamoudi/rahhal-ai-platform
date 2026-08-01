/**
 * Sprint 85 — ToolExecutor.
 * Receive ToolDecision → validate → execute (simulator) → normalize → unified response.
 */

import type { ExecutionContext } from './ExecutionContext'
import type { ExecutionSimulator } from './ExecutionSimulator'
import type { ExecutionTelemetryCollector } from './ExecutionTelemetry'
import type { ExecutionSafety } from './ExecutionSafety'
import type {
  ExecutableToolType,
  ToolDecision,
  ToolExecutorOptions,
  UnifiedToolResult,
} from './types'

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout<T>(work: () => Promise<T> | T, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return work()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export class ToolExecutor {
  private readonly simulator: ExecutionSimulator
  private readonly safety: ExecutionSafety
  private readonly options: Required<ToolExecutorOptions>

  constructor(
    simulator: ExecutionSimulator,
    safety: ExecutionSafety,
    options?: ToolExecutorOptions,
  ) {
    this.simulator = simulator
    this.safety = safety
    this.options = {
      timeoutMs: options?.timeoutMs ?? 50,
      maxAttempts: options?.maxAttempts ?? 3,
      backoffMs: options?.backoffMs ?? 0,
    }
  }

  async execute(
    decision: ToolDecision,
    ctx: ExecutionContext,
    telemetry: ExecutionTelemetryCollector,
    runtime?: {
      availableTools?: ExecutableToolType[]
      permissions?: Partial<Record<ExecutableToolType, boolean>>
      rateLimits?: Partial<Record<ExecutableToolType, number>>
      callCounts?: Partial<Record<ExecutableToolType, number>>
      failureInjector?: Partial<Record<ExecutableToolType, { failAttempts: number; error: string }>>
      enabledFlag?: boolean
    },
  ): Promise<UnifiedToolResult> {
    const policy = decision.policy ?? 'sequential'
    const event = telemetry.begin(decision.tool, policy)

    if (ctx.cancellation.cancelled || policy === 'cancel') {
      telemetry.finish(event, 'cancelled', false)
      return {
        tool: decision.tool,
        ok: false,
        status: 'cancelled',
        items: [],
        summary: `Cancelled: ${ctx.cancellation.reason ?? 'cancel policy'}`,
        meta: { simulated: true, source: 'execution_simulator', attempts: 0 },
      }
    }

    if (policy === 'skip' || decision.when === false) {
      telemetry.finish(event, 'skipped', false)
      return {
        tool: decision.tool,
        ok: false,
        status: 'skipped',
        items: [],
        summary: 'Skipped by policy/condition',
        meta: { simulated: true, source: 'execution_simulator', attempts: 0 },
      }
    }

    const block = this.safety.validateDecision(decision, ctx.knownSlots, {
      availableTools: runtime?.availableTools,
      permissions: runtime?.permissions,
      rateLimits: runtime?.rateLimits,
      callCounts: runtime?.callCounts,
    })
    if (block) {
      telemetry.recordFailure(event, block.reason)
      telemetry.finish(event, 'skipped', false)
      return {
        tool: decision.tool,
        ok: false,
        status: 'skipped',
        items: [],
        summary: `Safety block: ${block.reason}`,
        meta: { simulated: true, source: 'execution_simulator', attempts: 0 },
      }
    }

    let attempt = 0
    let lastError = 'unknown'
    const injector = runtime?.failureInjector?.[decision.tool]

    while (attempt < this.options.maxAttempts) {
      if (ctx.cancellation.cancelled) {
        telemetry.finish(event, 'cancelled', false)
        return {
          tool: decision.tool,
          ok: false,
          status: 'cancelled',
          items: [],
          summary: `Cancelled during retry: ${ctx.cancellation.reason ?? ''}`,
          meta: {
            simulated: true,
            source: 'execution_simulator',
            attempts: attempt,
          },
        }
      }

      attempt += 1
      telemetry.recordAttempt(event)
      try {
        if (injector && attempt <= injector.failAttempts) {
          throw new Error(injector.error)
        }

        const result = await withTimeout(
          () => this.simulator.execute(decision, ctx.knownSlots),
          this.options.timeoutMs,
        )
        const normalized: UnifiedToolResult = {
          ...result,
          meta: { ...result.meta, attempts: attempt, simulated: true },
        }
        telemetry.finish(event, 'succeeded', true)
        ctx.appendResult(normalized)
        return normalized
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'error'
        telemetry.recordFailure(event, lastError)
        if (attempt < this.options.maxAttempts) {
          await sleep(this.options.backoffMs)
          continue
        }
        break
      }
    }

    // Fallback recovery
    if (decision.fallback && decision.fallback !== decision.tool) {
      const fallbackDecision: ToolDecision = {
        tool: decision.fallback,
        reason: `Fallback from ${decision.tool}`,
        params: { ...decision.params },
        policy: 'fallback',
      }
      const fallbackResult = this.simulator.execute(fallbackDecision, ctx.knownSlots)
      const wrapped: UnifiedToolResult = {
        ...fallbackResult,
        tool: decision.tool,
        status: 'fallback',
        summary: `Fallback ${decision.fallback} used after ${decision.tool} failed: ${lastError}`,
        meta: {
          simulated: true,
          source: 'execution_simulator',
          attempts: attempt,
          fallbackFrom: decision.tool,
        },
      }
      // Keep items tagged under fallback tool kind for merger clarity.
      wrapped.items = fallbackResult.items
      telemetry.finish(event, 'fallback', true, decision.fallback)
      ctx.appendResult(wrapped)
      return wrapped
    }

    telemetry.finish(event, 'failed', false)
    const failed: UnifiedToolResult = {
      tool: decision.tool,
      ok: false,
      status: 'failed',
      items: [],
      summary: `Failed after ${attempt} attempt(s): ${lastError}`,
      meta: {
        simulated: true,
        source: 'execution_simulator',
        attempts: attempt,
      },
    }
    ctx.appendResult(failed)
    return failed
  }
}

export function createToolExecutor(
  simulator: ExecutionSimulator,
  safety: ExecutionSafety,
  options?: ToolExecutorOptions,
): ToolExecutor {
  return new ToolExecutor(simulator, safety, options)
}
