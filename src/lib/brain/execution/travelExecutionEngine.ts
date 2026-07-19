/**
 * Sprint 23 — TravelExecutionEngine
 * TripPlan → ExecutionPlan → ExecutionSummary (shared text/voice pipeline).
 */

import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'
import { ExecutionOrchestrator, type ExecutionOrchestratorHandle } from './orchestrator'
import type {
  ExecutionPlan,
  TravelExecutionEngineOptions,
  TravelExecutionTurnResult,
} from './types'

const lastResults = new Map<string, TravelExecutionTurnResult>()
const orchestrators = new Map<string, ExecutionOrchestratorHandle>()

export function resetTravelExecutionSessions(): void {
  lastResults.clear()
  orchestrators.clear()
}

/**
 * TravelExecutionEngine — accepts Sprint 22 TripPlan and produces executable search tasks.
 */
export function TravelExecutionEngine(options: TravelExecutionEngineOptions = {}) {
  const conversationId =
    options.conversationId ?? `exec_${Math.random().toString(36).slice(2, 8)}`

  let orchestrator = orchestrators.get(conversationId)
  if (!orchestrator) {
    orchestrator = ExecutionOrchestrator({
      providers: options.providers,
      maxRetries: options.maxRetries,
      defaultTimeoutMs: options.defaultTimeoutMs,
      parallelSafe: options.parallelSafe,
    })
    orchestrators.set(conversationId, orchestrator)
  }

  const buildFromTripPlan = (tripPlan: EngineTripPlan): ExecutionPlan =>
    orchestrator!.buildPlan({ conversationId, tripPlan })

  const execute = async (input: {
    tripPlan: EngineTripPlan
    signal?: AbortSignal
  }): Promise<TravelExecutionTurnResult> => {
    if (input.tripPlan.status !== 'complete') {
      const plan = buildFromTripPlan(input.tripPlan)
      plan.state = 'failed'
      const empty: TravelExecutionTurnResult = {
        plan,
        summary: {
          planId: plan.id,
          state: 'failed',
          progress: {
            total: plan.tasks.length,
            completed: 0,
            failed: 0,
            cancelled: 0,
            skipped: plan.tasks.length,
            running: 0,
            pending: 0,
            ratio: 0,
            currentTaskId: null,
          },
          results: [],
          successfulTypes: [],
          failedTypes: [],
          partialSuccess: false,
          durationMs: 0,
          headline: 'TripPlan incomplete — execution skipped',
        },
        results: [],
        progress: {
          total: plan.tasks.length,
          completed: 0,
          failed: 0,
          cancelled: 0,
          skipped: plan.tasks.length,
          running: 0,
          pending: 0,
          ratio: 0,
          currentTaskId: null,
        },
        state: 'failed',
      }
      lastResults.set(conversationId, empty)
      return empty
    }

    const result = await orchestrator!.run({
      conversationId,
      tripPlan: input.tripPlan,
      signal: input.signal,
    })
    lastResults.set(conversationId, result)
    return result
  }

  return {
    conversationId,
    buildFromTripPlan,
    execute,
    cancel: () => orchestrator!.cancel(),
    getLastResult: () => lastResults.get(conversationId) ?? null,
  }
}

export type TravelExecutionEngineHandle = ReturnType<typeof TravelExecutionEngine>

export function getLastTravelExecutionResult(
  conversationId: string,
): TravelExecutionTurnResult | null {
  return lastResults.get(conversationId) ?? null
}
