/**
 * Sprint 113 — ExecutionResult builders
 */

import type {
  ExecutionMetrics,
  ExecutionPlan,
  OrchestratorFinalResponse,
  OrchestratorResult,
  OrchestratorStageRecord,
  ExecutionContextSnapshot,
} from './types'
import { emptyMetrics, SPRINT113_AI_ORCHESTRATOR_VERSION } from './types'

export function buildDisabledOrchestratorResult(): OrchestratorResult {
  return {
    version: SPRINT113_AI_ORCHESTRATOR_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    plan: null,
    context: null,
    stages: [],
    metrics: emptyMetrics(),
    finalResponse: {
      headline: '',
      executiveSummary: '',
      recommendations: [],
      followUpQuestion: null,
      narrative: null,
      conciergeHints: [],
      warnings: [],
      confidence: 0,
      source: 'disabled',
    },
    artifacts: {
      memory: null,
      planner: null,
      providers: null,
      tripBuilder: null,
      decision: null,
      responseComposer: null,
      concierge: null,
    },
    validationErrors: [],
    logs: ['ai_orchestrator_disabled'],
    latencyMs: 0,
  }
}

export function buildOrchestratorResult(input: {
  ok: boolean
  empty: boolean
  plan: ExecutionPlan | null
  context: ExecutionContextSnapshot | null
  stages: OrchestratorStageRecord[]
  metrics: ExecutionMetrics
  finalResponse: OrchestratorFinalResponse | null
  artifacts: OrchestratorResult['artifacts']
  validationErrors: string[]
  logs: string[]
  latencyMs: number
}): OrchestratorResult {
  return {
    version: SPRINT113_AI_ORCHESTRATOR_VERSION,
    enabled: true,
    ok: input.ok,
    empty: input.empty,
    plan: input.plan,
    context: input.context,
    stages: input.stages,
    metrics: input.metrics,
    finalResponse: input.finalResponse,
    artifacts: input.artifacts,
    validationErrors: input.validationErrors,
    logs: input.logs,
    latencyMs: input.latencyMs,
  }
}

export class ExecutionResult {
  static disabled(): OrchestratorResult {
    return buildDisabledOrchestratorResult()
  }

  static build(
    input: Parameters<typeof buildOrchestratorResult>[0],
  ): OrchestratorResult {
    return buildOrchestratorResult(input)
  }
}

export function createExecutionResultHelpers(): typeof ExecutionResult {
  return ExecutionResult
}
