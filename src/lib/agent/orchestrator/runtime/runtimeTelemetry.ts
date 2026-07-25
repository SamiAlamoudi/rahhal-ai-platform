/**
 * Phase 2 Stage 4 — Runtime coordinator telemetry (no PII).
 */

import type { RuntimeStageId, RuntimeTelemetrySnapshot } from './runtimeTypes'

export interface RuntimeCoordinatorTelemetryEvent {
  timestamp: string
  success: boolean
  executionOrder: RuntimeStageId[]
  stageDurations: Record<string, number>
  cacheHits: number
  cacheMisses: number
  retries: number
  timeouts: number
  failures: number
  totalDurationMs: number
  failureCode: string | null
}

export interface RuntimeCoordinatorTelemetryStore {
  runCount: number
  successCount: number
  failureCount: number
  last: RuntimeCoordinatorTelemetryEvent | null
}

const MAX = 32
const events: RuntimeCoordinatorTelemetryEvent[] = []

export function recordRuntimeCoordinatorTelemetry(
  event: Omit<RuntimeCoordinatorTelemetryEvent, 'timestamp'> & { timestamp?: string },
): RuntimeCoordinatorTelemetryEvent {
  const full: RuntimeCoordinatorTelemetryEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    success: event.success,
    executionOrder: [...event.executionOrder],
    stageDurations: { ...event.stageDurations },
    cacheHits: event.cacheHits,
    cacheMisses: event.cacheMisses,
    retries: event.retries,
    timeouts: event.timeouts,
    failures: event.failures,
    totalDurationMs: event.totalDurationMs,
    failureCode: event.failureCode,
  }
  events.push(full)
  if (events.length > MAX) events.shift()
  return full
}

export function getRuntimeCoordinatorTelemetry(): RuntimeCoordinatorTelemetryStore {
  const successCount = events.filter((e) => e.success).length
  return {
    runCount: events.length,
    successCount,
    failureCount: events.length - successCount,
    last: events[events.length - 1] ?? null,
  }
}

export function resetRuntimeCoordinatorTelemetry(): void {
  events.length = 0
}

export function toTelemetrySnapshot(
  partial: Omit<RuntimeTelemetrySnapshot, never>,
): RuntimeTelemetrySnapshot {
  return {
    executionOrder: [...partial.executionOrder],
    stageDurations: { ...partial.stageDurations },
    cacheHits: partial.cacheHits,
    cacheMisses: partial.cacheMisses,
    retries: partial.retries,
    timeouts: partial.timeouts,
    failures: partial.failures,
    totalDurationMs: partial.totalDurationMs,
  }
}

export const RuntimeTelemetry = {
  record: recordRuntimeCoordinatorTelemetry,
  snapshot: getRuntimeCoordinatorTelemetry,
  reset: resetRuntimeCoordinatorTelemetry,
}
