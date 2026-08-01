/**
 * Sprint 88 Task 5 — Telemetry emitter interface (no network / OTel / persistence).
 */

import type {
  ShadowPreviewTelemetryEvent,
  ShadowTelemetryEmitResult,
} from './types'

export type ShadowTelemetrySink = {
  readonly name: string
  write(event: ShadowPreviewTelemetryEvent): void
}

export type ShadowTelemetryEmitterOptions = {
  /** Default false — disabled mode drops events. */
  enabled?: boolean
  sink?: ShadowTelemetrySink | null
  /** Deduplicate by traceId+executionStage+resultStatus (in-memory). */
  preventDuplicates?: boolean
}

/**
 * Preview-evaluation telemetry emitter.
 * Not registered in production. Not wired into BrainRouter / planTurn.
 */
export interface ShadowTelemetryEmitter {
  readonly enabled: boolean
  emit(
    candidate: Record<string, unknown> | ShadowPreviewTelemetryEvent,
  ): ShadowTelemetryEmitResult
  /** Test/helper — clear duplicate tracking. */
  resetDedup(): void
}
