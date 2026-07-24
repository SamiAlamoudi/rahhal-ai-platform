/**
 * Phase 2 Stage 2 — Lightweight consultant pipeline telemetry.
 * No personal data. CPU-only counters for activation metrics.
 */

export interface ConsultantPipelineTelemetryEvent {
  timestamp: string
  success: boolean
  totalDurationMs: number
  stageTimings: Record<string, number>
  confidence: number
  clarificationCount: number
  stoppedEarly: boolean
  stageCount: number
  /** Generic failure code only — never user text / PII. */
  failureCode: string | null
}

export interface ConsultantPipelineTelemetrySnapshot {
  runCount: number
  successCount: number
  failureCount: number
  last: ConsultantPipelineTelemetryEvent | null
}

const MAX_EVENTS = 32
const events: ConsultantPipelineTelemetryEvent[] = []

export function recordConsultantPipelineTelemetry(
  event: Omit<ConsultantPipelineTelemetryEvent, 'timestamp'> & { timestamp?: string },
): ConsultantPipelineTelemetryEvent {
  const full: ConsultantPipelineTelemetryEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    success: event.success,
    totalDurationMs: event.totalDurationMs,
    stageTimings: { ...event.stageTimings },
    confidence: event.confidence,
    clarificationCount: event.clarificationCount,
    stoppedEarly: event.stoppedEarly,
    stageCount: event.stageCount,
    failureCode: event.failureCode,
  }
  events.push(full)
  if (events.length > MAX_EVENTS) events.shift()
  return full
}

export function getConsultantPipelineTelemetry(): ConsultantPipelineTelemetrySnapshot {
  const successCount = events.filter((e) => e.success).length
  return {
    runCount: events.length,
    successCount,
    failureCount: events.length - successCount,
    last: events[events.length - 1] ?? null,
  }
}

export function resetConsultantPipelineTelemetry(): void {
  events.length = 0
}

export const ConsultantTelemetry = {
  record: recordConsultantPipelineTelemetry,
  snapshot: getConsultantPipelineTelemetry,
  reset: resetConsultantPipelineTelemetry,
}
