/**
 * Sprint 115 — PipelineMetrics
 */

import type { PipelineStageId, PipelineStageResult } from './PipelineStages'

export interface PipelineMetrics {
  pipelineDurationMs: number
  conversationDurationMs: number
  memoryDurationMs: number
  preferenceDurationMs: number
  searchPlanningDurationMs: number
  flightSearchDurationMs: number
  hotelSearchDurationMs: number
  decisionDurationMs: number
  tripBuilderDurationMs: number
  itineraryDurationMs: number
  responseDurationMs: number
  conciergeDurationMs: number
  finalDurationMs: number
  stagesCompleted: number
  stagesSkipped: number
  stagesFailed: number
  stagesRecovered: number
  stagesTimedOut: number
  confidence: number
  retryCount: number
}

function durationOf(
  stages: PipelineStageResult[],
  id: PipelineStageId,
): number {
  return stages.find((s) => s.stageId === id)?.durationMs ?? 0
}

export function collectPipelineMetrics(input: {
  pipelineDurationMs: number
  stages: PipelineStageResult[]
  confidence: number
}): PipelineMetrics {
  const stages = input.stages
  let completed = 0
  let skipped = 0
  let failed = 0
  let recovered = 0
  let timedOut = 0
  let retryCount = 0
  for (const s of stages) {
    retryCount += s.retried
    if (s.status === 'completed') completed += 1
    else if (s.status === 'skipped') skipped += 1
    else if (s.status === 'failed') failed += 1
    else if (s.status === 'recovered') {
      recovered += 1
      completed += 1
    } else if (s.status === 'timed_out') timedOut += 1
  }

  return {
    pipelineDurationMs: input.pipelineDurationMs,
    conversationDurationMs: durationOf(stages, 'conversation'),
    memoryDurationMs: durationOf(stages, 'memory'),
    preferenceDurationMs: durationOf(stages, 'preference_resolution'),
    searchPlanningDurationMs: durationOf(stages, 'search_planning'),
    flightSearchDurationMs: durationOf(stages, 'flight_search'),
    hotelSearchDurationMs: durationOf(stages, 'hotel_search'),
    decisionDurationMs: durationOf(stages, 'decision'),
    tripBuilderDurationMs: durationOf(stages, 'trip_builder'),
    itineraryDurationMs: durationOf(stages, 'itinerary'),
    responseDurationMs: durationOf(stages, 'response_composer'),
    conciergeDurationMs: durationOf(stages, 'concierge'),
    finalDurationMs: durationOf(stages, 'final'),
    stagesCompleted: completed,
    stagesSkipped: skipped,
    stagesFailed: failed,
    stagesRecovered: recovered,
    stagesTimedOut: timedOut,
    confidence: input.confidence,
    retryCount,
  }
}

export function emptyPipelineMetrics(): PipelineMetrics {
  return collectPipelineMetrics({
    pipelineDurationMs: 0,
    stages: [],
    confidence: 0,
  })
}

export class PipelineMetricsCollector {
  collect(input: {
    pipelineDurationMs: number
    stages: PipelineStageResult[]
    confidence: number
  }): PipelineMetrics {
    return collectPipelineMetrics(input)
  }
}

export function createPipelineMetricsCollector(): PipelineMetricsCollector {
  return new PipelineMetricsCollector()
}
