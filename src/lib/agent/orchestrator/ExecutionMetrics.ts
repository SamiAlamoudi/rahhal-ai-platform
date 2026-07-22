/**
 * Sprint 113 — ExecutionMetrics helpers
 */

import type { ExecutionMetrics, OrchestratorStageRecord } from './types'
import { emptyMetrics } from './types'

export function collectExecutionMetrics(input: {
  pipelineDurationMs: number
  timing: Record<string, number>
  stages: OrchestratorStageRecord[]
  confidence: number
  totalTokens?: number
}): ExecutionMetrics {
  const metrics = emptyMetrics()
  metrics.pipelineDurationMs = input.pipelineDurationMs
  metrics.memoryDurationMs = input.timing.memory ?? 0
  metrics.plannerDurationMs = input.timing.planner ?? 0
  metrics.providerLatencyMs = input.timing.providers ?? 0
  metrics.tripBuilderDurationMs = input.timing.trip_builder ?? 0
  metrics.decisionDurationMs = input.timing.decision ?? 0
  metrics.responseDurationMs = input.timing.response_composer ?? 0
  metrics.conciergeDurationMs = input.timing.concierge ?? 0
  metrics.totalTokens = input.totalTokens ?? 0
  metrics.confidence = input.confidence
  metrics.stagesCompleted = input.stages.filter((s) => s.status === 'completed' || s.status === 'cached').length
  metrics.stagesSkipped = input.stages.filter((s) => s.status === 'skipped').length
  metrics.stagesFailed = input.stages.filter((s) => s.status === 'failed').length
  return metrics
}

export class ExecutionMetricsCollector {
  collect(input: Parameters<typeof collectExecutionMetrics>[0]): ExecutionMetrics {
    return collectExecutionMetrics(input)
  }
}

export function createExecutionMetricsCollector(): ExecutionMetricsCollector {
  return new ExecutionMetricsCollector()
}
