/**
 * Sprint 88 Task 5 — Shadow telemetry (preview evaluation metadata only).
 * Not wired into BrainRouter / planTurn / production.
 */

export {
  SHADOW_TELEMETRY_CONTRACT_VERSION,
  type ShadowExecutionStage,
  type ShadowResultStatus,
  type ShadowLatencyBucket,
  type ShadowErrorCategory,
  type ShadowPreviewTelemetryEvent,
  type ShadowTelemetryEmitResult,
} from './types'

export {
  SHADOW_TELEMETRY_FORBIDDEN_KEYS,
  isForbiddenTelemetryKey,
  redactTelemetryRecord,
  sanitizeShadowTelemetryEvent,
  toLatencyBucket,
} from './redaction'

export type {
  ShadowTelemetrySink,
  ShadowTelemetryEmitter,
  ShadowTelemetryEmitterOptions,
} from './emitter'

export {
  InMemoryShadowTelemetrySink,
  createInMemoryShadowTelemetrySink,
  createShadowTelemetryEmitter,
} from './inMemorySink'
