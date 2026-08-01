/**
 * Sprint 85 — Shared execution context.
 */

import type { TravelPlan, TravelPlanSlots } from '../planning/types'
import { createCancellationToken } from './CancellationToken'
import type {
  CancellationToken,
  ExecutionContextSnapshot,
  ExecutionTelemetry,
  UnifiedToolResult,
} from './types'

export class ExecutionContext {
  conversationSummary: string | null
  memoryNotes: string[]
  travelPlan: TravelPlan | null
  knownSlots: TravelPlanSlots | null
  previousResults: UnifiedToolResult[]
  telemetry: ExecutionTelemetry
  cancellation: CancellationToken

  constructor(input?: {
    conversationSummary?: string | null
    memoryNotes?: string[]
    travelPlan?: TravelPlan | null
    knownSlots?: TravelPlanSlots | null
    previousResults?: UnifiedToolResult[]
    cancellationToken?: CancellationToken
  }) {
    this.conversationSummary = input?.conversationSummary ?? null
    this.memoryNotes = [...(input?.memoryNotes ?? [])]
    this.travelPlan = input?.travelPlan ?? null
    this.knownSlots = input?.knownSlots
      ? {
          ...input.knownSlots,
          dates: { ...input.knownSlots.dates },
          activities: [...input.knownSlots.activities],
        }
      : input?.travelPlan?.knownSlots
        ? {
            ...input.travelPlan.knownSlots,
            dates: { ...input.travelPlan.knownSlots.dates },
            activities: [...input.travelPlan.knownSlots.activities],
          }
        : null
    this.previousResults = [...(input?.previousResults ?? [])]
    this.telemetry = {
      totalDurationMs: 0,
      events: [],
      parallelBatches: [],
      failures: 0,
      retries: 0,
      fallbacks: 0,
    }
    this.cancellation = input?.cancellationToken ?? createCancellationToken()
  }

  appendResult(result: UnifiedToolResult): void {
    this.previousResults = [...this.previousResults, result]
  }

  snapshot(): ExecutionContextSnapshot {
    return {
      conversationSummary: this.conversationSummary,
      memoryNotes: [...this.memoryNotes],
      travelPlan: this.travelPlan,
      knownSlots: this.knownSlots
        ? {
            ...this.knownSlots,
            dates: { ...this.knownSlots.dates },
            activities: [...this.knownSlots.activities],
          }
        : null,
      previousResults: this.previousResults.map((r) => ({
        ...r,
        items: r.items.map((i) => ({ ...i })),
        meta: { ...r.meta },
      })),
      telemetry: {
        ...this.telemetry,
        events: this.telemetry.events.map((e) => ({
          ...e,
          failures: [...e.failures],
        })),
        parallelBatches: this.telemetry.parallelBatches.map((b) => [...b]),
      },
      cancellation: this.cancellation,
    }
  }
}

export function createExecutionContext(
  input?: ConstructorParameters<typeof ExecutionContext>[0],
): ExecutionContext {
  return new ExecutionContext(input)
}
