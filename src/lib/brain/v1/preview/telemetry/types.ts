/**
 * Sprint 88 Task 5 — Shadow telemetry contracts (preview evaluation only).
 * Infrastructure types — not wired into BrainRouter / planTurn.
 */

export const SHADOW_TELEMETRY_CONTRACT_VERSION = 'sprint88-shadow-telemetry-1' as const

export type ShadowExecutionStage =
  | 'evaluate'
  | 'preview_route'
  | 'fallback'
  | 'complete'

export type ShadowResultStatus =
  | 'ok'
  | 'fallback'
  | 'error'
  | 'skipped_disabled'

/** Coarse latency buckets — never store raw high-resolution timings with PII. */
export type ShadowLatencyBucket =
  | 'lt_50ms'
  | 'lt_100ms'
  | 'lt_250ms'
  | 'lt_500ms'
  | 'lt_1000ms'
  | 'gte_1000ms'
  | 'unknown'

export type ShadowErrorCategory =
  | 'brain_exception'
  | 'brain_empty'
  | 'invalid_result'
  | 'insufficient_confidence'
  | 'unknown'
  | null

/**
 * Preview evaluation metadata only.
 * MUST NOT include user text, passport, names, emails, phones,
 * payment, booking ids, provider payloads, or search queries.
 */
export type ShadowPreviewTelemetryEvent = {
  readonly schemaVersion: typeof SHADOW_TELEMETRY_CONTRACT_VERSION
  readonly traceId: string
  readonly conversationId?: string | null
  readonly timestamp: string
  readonly scenarioId: string | null
  readonly plannerVersion: string
  readonly previewEnabled: boolean
  readonly fallbackTriggered: boolean
  readonly executionStage: ShadowExecutionStage
  readonly latencyBucket: ShadowLatencyBucket
  readonly resultStatus: ShadowResultStatus
  readonly errorCategory?: ShadowErrorCategory
}

export type ShadowTelemetryEmitResult =
  | { ok: true; accepted: true; duplicate: false }
  | { ok: true; accepted: false; duplicate: true }
  | { ok: true; accepted: false; duplicate: false; reason: 'disabled' }
  | { ok: false; reason: string }
