/**
 * Phase 2 Stage 3 — Consultant response telemetry (no PII).
 */

export interface ConsultantResponseTelemetryEvent {
  timestamp: string
  success: boolean
  responseGenerationMs: number
  aggregationMs: number
  confidence: number
  questionCount: number
  failureCode: string | null
}

export interface ConsultantResponseTelemetrySnapshot {
  runCount: number
  successCount: number
  failureCount: number
  last: ConsultantResponseTelemetryEvent | null
}

const MAX_EVENTS = 32
const events: ConsultantResponseTelemetryEvent[] = []

export function recordConsultantResponseTelemetry(
  event: Omit<ConsultantResponseTelemetryEvent, 'timestamp'> & { timestamp?: string },
): ConsultantResponseTelemetryEvent {
  const full: ConsultantResponseTelemetryEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    success: event.success,
    responseGenerationMs: event.responseGenerationMs,
    aggregationMs: event.aggregationMs,
    confidence: event.confidence,
    questionCount: event.questionCount,
    failureCode: event.failureCode,
  }
  events.push(full)
  if (events.length > MAX_EVENTS) events.shift()
  return full
}

export function getConsultantResponseTelemetry(): ConsultantResponseTelemetrySnapshot {
  const successCount = events.filter((e) => e.success).length
  return {
    runCount: events.length,
    successCount,
    failureCount: events.length - successCount,
    last: events[events.length - 1] ?? null,
  }
}

export function resetConsultantResponseTelemetry(): void {
  events.length = 0
}

export const ConsultantResponseTelemetry = {
  record: recordConsultantResponseTelemetry,
  snapshot: getConsultantResponseTelemetry,
  reset: resetConsultantResponseTelemetry,
}
