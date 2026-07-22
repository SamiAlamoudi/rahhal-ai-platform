/**
 * Sprint 116 — StreamingMetrics
 */

import type { StreamingEvent } from './StreamingEvents'
import type { StreamingStageId } from './StreamingStage'

export interface StreamingMetrics {
  totalDurationMs: number
  eventCount: number
  stagesStarted: number
  stagesCompleted: number
  stagesSkipped: number
  warnings: number
  errors: number
  progressEvents: number
  averageStageDurationMs: number
  confidence: number
  perStageDurationMs: Partial<Record<StreamingStageId, number>>
}

export function collectStreamingMetrics(input: {
  events: readonly StreamingEvent[]
  totalDurationMs: number
  confidence: number
}): StreamingMetrics {
  const perStageDurationMs: Partial<Record<StreamingStageId, number>> = {}
  let stagesStarted = 0
  let stagesCompleted = 0
  let stagesSkipped = 0
  let warnings = 0
  let errors = 0
  let progressEvents = 0
  let durationSum = 0
  let durationCount = 0

  for (const e of input.events) {
    if (e.kind === 'started') stagesStarted += 1
    if (e.kind === 'completed') {
      stagesCompleted += 1
      if (e.durationMs != null) {
        perStageDurationMs[e.stage] = e.durationMs
        durationSum += e.durationMs
        durationCount += 1
      }
    }
    if (e.kind === 'skipped') stagesSkipped += 1
    if (e.kind === 'warning') warnings += 1
    if (e.kind === 'error') errors += 1
    if (e.kind === 'progress') progressEvents += 1
  }

  return {
    totalDurationMs: input.totalDurationMs,
    eventCount: input.events.length,
    stagesStarted,
    stagesCompleted,
    stagesSkipped,
    warnings,
    errors,
    progressEvents,
    averageStageDurationMs:
      durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
    confidence: input.confidence,
    perStageDurationMs,
  }
}

export function emptyStreamingMetrics(): StreamingMetrics {
  return collectStreamingMetrics({
    events: [],
    totalDurationMs: 0,
    confidence: 0,
  })
}

export class StreamingMetricsCollector {
  collect(input: {
    events: readonly StreamingEvent[]
    totalDurationMs: number
    confidence: number
  }): StreamingMetrics {
    return collectStreamingMetrics(input)
  }
}

export function createStreamingMetricsCollector(): StreamingMetricsCollector {
  return new StreamingMetricsCollector()
}
