import { buildToolInput } from './buildToolInput'
import type {
  AgentTool,
  AgentToolContext,
  AgentToolName,
  AgentToolRegistry,
  AgentToolResult,
  ToolExecutionBatch,
  ToolExecutionMeta,
  ToolExecutionRequest,
} from './types'

export interface ToolExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionBatch>
}

export function createToolExecutor(registry: AgentToolRegistry): ToolExecutor {
  return {
    async execute(request) {
      const batchStarted = Date.now()
      const selected = request.names ?? registry.list()
      const results: AgentToolResult[] = []

      for (const name of selected) {
        results.push(await invokeTool(registry.get(name), name, request))
      }

      const okCount = results.filter((r) => r.status === 'ok').length
      const failedCount = results.filter((r) => r.status === 'error' || r.status === 'timeout').length
      return {
        results,
        selected,
        okCount,
        failedCount,
        durationMs: Date.now() - batchStarted,
      }
    },
  }
}

async function invokeTool(
  tool: AgentTool | undefined,
  name: AgentToolName,
  request: ToolExecutionRequest,
): Promise<AgentToolResult> {
  if (!tool) {
    return {
      tool: name,
      status: 'unavailable',
      summary: `Tool ${name} is not registered`,
      error: 'not_registered',
      meta: emptyMeta('none', request.timeoutMs ?? 0),
    }
  }
  if (!tool.isAvailable()) {
    return {
      tool: name,
      status: 'unavailable',
      summary: `Tool ${name} is not available`,
      error: 'not_available',
      meta: emptyMeta(tool.providerId, request.timeoutMs ?? tool.defaultTimeoutMs),
    }
  }

  const timeoutMs = request.timeoutMs ?? tool.defaultTimeoutMs
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  const input = buildToolInput(name, request.ctx.requirements, request.ctx.locale)
  const ctx: AgentToolContext = { ...request.ctx, input }

  try {
    const result = await withTimeout(tool.execute(ctx), timeoutMs, request.ctx.signal)
    const finishedAt = new Date().toISOString()
    const meta: ToolExecutionMeta = {
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      timeoutMs,
      providerId: tool.providerId,
      attempt: 1,
    }
    return {
      ...result,
      tool: name,
      error: result.error ?? null,
      meta: result.meta ?? meta,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e ?? 'tool_error')
    const isTimeout = message === 'tool_timeout' || message.includes('timeout')
    const finishedAt = new Date().toISOString()
    return {
      tool: name,
      status: isTimeout ? 'timeout' : 'error',
      summary: isTimeout
        ? `Tool ${name} timed out after ${timeoutMs}ms`
        : `Tool ${name} failed: ${message}`,
      error: message,
      meta: {
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,
        timeoutMs,
        providerId: tool.providerId,
        attempt: 1,
      },
    }
  }
}

function emptyMeta(providerId: string, timeoutMs: number): ToolExecutionMeta {
  const now = new Date().toISOString()
  return {
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    timeoutMs,
    providerId,
    attempt: 0,
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
