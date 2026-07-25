/**
 * Phase 6 — Tool lifecycle executor (ready → running → completed/failed/retry/timeout/cancelled).
 */

import type { LiveTravelMemory } from '../../conversationIntelligence'
import type { ToolDecisionKind } from '../../llmBrain'
import type { ExecutionEvents } from '../executionEvents'
import type { RuntimeToolId, ToolExecutionRecord, ToolLifecycleStatus } from '../types'
import { MOCK_TOOL_ADAPTERS } from './mockAdapters'
import type { ToolAdapter } from './types'

function mapDecisionToTool(decision: ToolDecisionKind): RuntimeToolId {
  switch (decision) {
    case 'search_flights':
      return 'flights'
    case 'search_hotels':
      return 'hotels'
    case 'need_weather':
      return 'weather'
    case 'need_visa':
      return 'visa'
    case 'need_currency':
      return 'currency'
    case 'need_map':
      return 'maps'
    case 'need_itinerary':
      return 'activities'
    case 'ask_question':
    case 'continue_conversation':
    case 'none':
    default:
      return 'none'
  }
}

export async function executeRuntimeTool(input: {
  decision: ToolDecisionKind
  memory: LiveTravelMemory
  userText: string
  events: ExecutionEvents
  forceFailureOnce?: boolean
  cancelled?: boolean
  maxAttempts?: number
}): Promise<ToolExecutionRecord | null> {
  const toolId = mapDecisionToTool(input.decision)
  if (toolId === 'none') return null

  const adapter: ToolAdapter | undefined = MOCK_TOOL_ADAPTERS[toolId]
  if (!adapter) return null

  const maxAttempts = input.maxAttempts ?? 2
  let attempt = 0
  let lastError: string | null = null
  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  input.events.publish('ToolStarted', toolId, { status: 'ready' as ToolLifecycleStatus })

  if (input.cancelled) {
    input.events.publish('ToolFinished', `${toolId}:cancelled`)
    return {
      toolId,
      status: 'cancelled',
      startedAt,
      finishedAt: new Date().toISOString(),
      attempt: 0,
      resultSummary: null,
      error: 'cancelled',
      durationMs: Date.now() - t0,
    }
  }

  while (attempt < maxAttempts) {
    attempt += 1
    const status: ToolLifecycleStatus = attempt > 1 ? 'retry' : 'running'
    input.events.publish('ToolStarted', `${toolId}:${status}`, { attempt })

    if (input.forceFailureOnce && attempt === 1) {
      lastError = 'mock_tool_failure'
      continue
    }

    try {
      const result = await adapter.execute({
        memory: input.memory,
        userText: input.userText,
        attempt,
      })
      input.events.publish('ToolFinished', `${toolId}:completed`, { summary: result.summary })
      return {
        toolId,
        status: 'completed',
        startedAt,
        finishedAt: new Date().toISOString(),
        attempt,
        resultSummary: result.summary,
        error: null,
        durationMs: Date.now() - t0,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'tool_error'
    }
  }

  input.events.publish('ToolFinished', `${toolId}:failed`, { error: lastError })
  return {
    toolId,
    status: 'failed',
    startedAt,
    finishedAt: new Date().toISOString(),
    attempt,
    resultSummary: null,
    error: lastError ?? 'failed',
    durationMs: Date.now() - t0,
  }
}

export { mapDecisionToTool }
