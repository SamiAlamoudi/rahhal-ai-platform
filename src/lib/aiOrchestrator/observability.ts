/**
 * Sprint 43 — orchestrator observability (selected tools, timing, planner, fallbacks, errors).
 */

import type {
  OrchestratorObservability,
  OrchestratorToolId,
  PlannerDecision,
} from './types'

export type OrchestratorLogSink = (entry: Record<string, unknown>) => void

const defaultSink: OrchestratorLogSink = (entry) => {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[rahhal-ai-orchestrator]', entry)
  }
}

export function createOrchestratorObservability(options?: {
  sink?: OrchestratorLogSink
}): {
  log: OrchestratorLogSink
  build: (input: {
    selectedTools: OrchestratorToolId[]
    startedAt: number
    plannerDecisions: PlannerDecision
    fallbackReasons: string[]
    errors: Array<{ tool?: OrchestratorToolId; message: string }>
    parallelWaves: number
  }) => OrchestratorObservability
} {
  const sink = options?.sink ?? defaultSink

  return {
    log: sink,
    build(input) {
      const obs: OrchestratorObservability = {
        selectedTools: [...input.selectedTools],
        executionTimeMs: Math.max(0, Date.now() - input.startedAt),
        plannerDecisions: input.plannerDecisions,
        fallbackReasons: [...input.fallbackReasons],
        errors: [...input.errors],
        parallelWaves: input.parallelWaves,
      }
      sink({
        type: 'orchestrator_turn',
        selectedTools: obs.selectedTools,
        executionTimeMs: obs.executionTimeMs,
        intent: obs.plannerDecisions.intent,
        plannerReason: obs.plannerDecisions.reason,
        stages: obs.plannerDecisions.stages,
        waves: obs.plannerDecisions.waves.map((w) => ({
          parallel: w.parallel,
          tools: w.tools,
        })),
        memoryHintsUsed: obs.plannerDecisions.memoryHintsUsed,
        fallbackReasons: obs.fallbackReasons,
        errors: obs.errors,
        parallelWaves: obs.parallelWaves,
      })
      return obs
    },
  }
}
