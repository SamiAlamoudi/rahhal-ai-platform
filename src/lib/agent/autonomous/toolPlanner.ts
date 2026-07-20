/**
 * Tool Planner — picks the next tool, executes with retries, recovers via alternatives.
 */

import { DEFAULT_RETRY_POLICY, withRetry } from '../aggregation/retry'
import { buildToolInput } from '../tools/buildToolInput'
import type {
  AgentTool,
  AgentToolContext,
  AgentToolName,
  AgentToolRegistry,
  AgentToolResult,
  ToolExecutionBatch,
} from '../tools/types'
import type { AutonomousProgressEvent, AutonomousTask } from './types'

export interface ToolPlannerProgress {
  (event: Omit<AutonomousProgressEvent, 'at'> & { at?: string }): void
}

export interface PlannedToolStep {
  tool: AgentToolName
  attempt: number
  recovered: boolean
  result: AgentToolResult
}

export interface ToolPlannerRunResult {
  results: AgentToolResult[]
  steps: PlannedToolStep[]
  selected: AgentToolName[]
  okCount: number
  failedCount: number
  durationMs: number
  totalRetries: number
  recoveredFromFailures: boolean
  batch: ToolExecutionBatch
}

/**
 * Default alternative map — when a tool fails after retries, try these next.
 * Never aborts the whole run because one provider failed.
 */
export const DEFAULT_TOOL_ALTERNATIVES: Partial<Record<AgentToolName, AgentToolName[]>> = {
  attractions: ['maps'],
  maps: ['attractions'],
  transportation: ['maps'],
  visa: [],
  currency: [],
  local_recommendations: ['attractions', 'maps'],
}

export function nextToolForTask(task: AutonomousTask): AgentToolName | null {
  return task.tool ?? null
}

export function resolveAlternatives(
  tool: AgentToolName,
  taskAlternatives?: AgentToolName[],
): AgentToolName[] {
  if (taskAlternatives?.length) return taskAlternatives
  return DEFAULT_TOOL_ALTERNATIVES[tool] ?? []
}

export async function executeToolWithRetry(input: {
  registry: AgentToolRegistry
  toolName: AgentToolName
  ctx: AgentToolContext
  maxRetries?: number
  onAttempt?: (info: { tool: AgentToolName; attempt: number; providerId: string }) => void
}): Promise<{ result: AgentToolResult; retries: number }> {
  const tool = input.registry.get(input.toolName)
  if (!tool) {
    return {
      retries: 0,
      result: unavailableResult(input.toolName, 'none', 'not_registered'),
    }
  }
  if (!tool.isAvailable()) {
    return {
      retries: 0,
      result: unavailableResult(input.toolName, tool.providerId, 'not_available'),
    }
  }

  const maxAttempts = Math.max(1, (input.maxRetries ?? 2) + 1)
  try {
    const { value, attempts } = await withRetry({
      policy: {
        ...DEFAULT_RETRY_POLICY,
        maxAttempts,
        baseDelayMs: 5,
        maxDelayMs: 40,
      },
      signal: input.ctx.signal,
      shouldRetry: (error, attempt) => {
        if (input.ctx.signal?.aborted) return false
        const msg = error instanceof Error ? error.message : String(error ?? '')
        if (msg === 'aborted') return false
        return attempt < maxAttempts
      },
      run: async (attempt) => {
        input.onAttempt?.({
          tool: input.toolName,
          attempt,
          providerId: tool.providerId,
        })
        return invokeOnce(tool, input.ctx, attempt)
      },
    })
    return { result: value, retries: Math.max(0, attempts - 1) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'tool_error')
    return {
      retries: Math.max(0, maxAttempts - 1),
      result: {
        tool: input.toolName,
        status: message.includes('timeout') ? 'timeout' : 'error',
        summary: `Tool ${input.toolName} failed after retries: ${message}`,
        error: message,
        meta: {
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          timeoutMs: tool.defaultTimeoutMs,
          providerId: tool.providerId,
          attempt: maxAttempts,
        },
      },
    }
  }
}

/**
 * Execute a sequence of planned tools with retry + alternative recovery.
 */
export async function runToolPlan(input: {
  registry: AgentToolRegistry
  tools: Array<{ name: AgentToolName; alternatives?: AgentToolName[]; maxRetries?: number }>
  ctx: AgentToolContext
  onProgress?: ToolPlannerProgress
}): Promise<ToolPlannerRunResult> {
  const started = Date.now()
  const results: AgentToolResult[] = []
  const steps: PlannedToolStep[] = []
  const selected: AgentToolName[] = []
  let totalRetries = 0
  let recoveredFromFailures = false

  for (const step of input.tools) {
    selected.push(step.name)
    input.onProgress?.({
      phase: 'Searching',
      state: 'WAITING_PROVIDER',
      message: `Executing ${step.name}`,
      providerId: input.registry.get(step.name)?.providerId,
      retryCount: 0,
    })

    const primary = await executeToolWithRetry({
      registry: input.registry,
      toolName: step.name,
      ctx: input.ctx,
      maxRetries: step.maxRetries ?? 2,
      onAttempt: (info) => {
        input.onProgress?.({
          phase: 'Searching',
          state: info.attempt > 1 ? 'RECOVERING' : 'WAITING_PROVIDER',
          message: `Provider ${info.providerId} attempt ${info.attempt}`,
          providerId: info.providerId,
          retryCount: Math.max(0, info.attempt - 1),
        })
      },
    })
    totalRetries += primary.retries

    if (primary.result.status === 'ok') {
      results.push(primary.result)
      steps.push({
        tool: step.name,
        attempt: primary.retries + 1,
        recovered: false,
        result: primary.result,
      })
      continue
    }

    // Recovery — try alternatives; never terminate the whole plan.
    input.onProgress?.({
      phase: 'Searching',
      state: 'RECOVERING',
      message: `Recovering from ${step.name} failure`,
      providerId: primary.result.meta?.providerId,
      retryCount: primary.retries,
    })

    const alternatives = resolveAlternatives(step.name, step.alternatives)
      .filter((name) => name !== step.name && !selected.includes(name))

    let recovered: AgentToolResult | null = null
    for (const alt of alternatives) {
      selected.push(alt)
      const altRun = await executeToolWithRetry({
        registry: input.registry,
        toolName: alt,
        ctx: input.ctx,
        maxRetries: 1,
      })
      totalRetries += altRun.retries
      if (altRun.result.status === 'ok') {
        recovered = altRun.result
        recoveredFromFailures = true
        steps.push({
          tool: alt,
          attempt: altRun.retries + 1,
          recovered: true,
          result: altRun.result,
        })
        break
      }
      results.push(altRun.result)
      steps.push({
        tool: alt,
        attempt: altRun.retries + 1,
        recovered: false,
        result: altRun.result,
      })
    }

    // Always keep the primary failure for observability, plus recovery if any.
    results.push(primary.result)
    steps.push({
      tool: step.name,
      attempt: primary.retries + 1,
      recovered: false,
      result: primary.result,
    })
    if (recovered) {
      results.push(recovered)
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length
  const failedCount = results.filter((r) => r.status === 'error' || r.status === 'timeout').length
  const durationMs = Date.now() - started
  return {
    results,
    steps,
    selected: [...new Set(selected)],
    okCount,
    failedCount,
    durationMs,
    totalRetries,
    recoveredFromFailures,
    batch: {
      results,
      selected: [...new Set(selected)],
      okCount,
      failedCount,
      durationMs,
    },
  }
}

async function invokeOnce(
  tool: AgentTool,
  ctx: AgentToolContext,
  attempt: number,
): Promise<AgentToolResult> {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const input = buildToolInput(tool.name, ctx.requirements, ctx.locale)
  const fullCtx: AgentToolContext = { ...ctx, input }
  try {
    const result = await withTimeout(tool.execute(fullCtx), tool.defaultTimeoutMs, ctx.signal)
    if (result.status !== 'ok') {
      // Treat soft failures as retryable errors so withRetry can recover.
      throw new Error(result.error || result.summary || `${tool.name}_failed`)
    }
    return {
      ...result,
      tool: tool.name,
      meta: {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        timeoutMs: tool.defaultTimeoutMs,
        providerId: tool.providerId,
        attempt,
      },
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error ?? 'tool_error'))
  }
}

function unavailableResult(
  tool: AgentToolName,
  providerId: string,
  error: string,
): AgentToolResult {
  const now = new Date().toISOString()
  return {
    tool,
    status: 'unavailable',
    summary: `Tool ${tool} is ${error}`,
    error,
    meta: {
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      timeoutMs: 0,
      providerId,
      attempt: 0,
    },
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('tool_timeout'))
    }, timeoutMs)
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}
