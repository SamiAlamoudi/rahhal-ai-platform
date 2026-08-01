/**
 * Sprint 88 Task 5 — In-memory telemetry sink for unit tests only.
 * No persistence · no network · no production registration.
 */

import { sanitizeShadowTelemetryEvent } from './redaction'
import type {
  ShadowTelemetryEmitter,
  ShadowTelemetryEmitterOptions,
  ShadowTelemetrySink,
} from './emitter'
import type {
  ShadowPreviewTelemetryEvent,
  ShadowTelemetryEmitResult,
} from './types'

export class InMemoryShadowTelemetrySink implements ShadowTelemetrySink {
  readonly name = 'in_memory_shadow_telemetry'
  private readonly events: ShadowPreviewTelemetryEvent[] = []

  write(event: ShadowPreviewTelemetryEvent): void {
    this.events.push(event)
  }

  list(): readonly ShadowPreviewTelemetryEvent[] {
    return this.events
  }

  clear(): void {
    this.events.length = 0
  }

  count(): number {
    return this.events.length
  }
}

export function createInMemoryShadowTelemetrySink(): InMemoryShadowTelemetrySink {
  return new InMemoryShadowTelemetrySink()
}

function dedupeKey(event: ShadowPreviewTelemetryEvent): string {
  return `${event.traceId}|${event.executionStage}|${event.resultStatus}|${event.scenarioId ?? ''}`
}

/**
 * Create an emitter. Defaults to **disabled** with no sink (safe no-op).
 */
export function createShadowTelemetryEmitter(
  options: ShadowTelemetryEmitterOptions = {},
): ShadowTelemetryEmitter {
  const enabled = options.enabled === true
  const sink = options.sink ?? null
  const preventDuplicates = options.preventDuplicates !== false
  const seen = new Set<string>()

  return {
    get enabled() {
      return enabled
    },
    resetDedup() {
      seen.clear()
    },
    emit(candidate): ShadowTelemetryEmitResult {
      if (!enabled) {
        return { ok: true, accepted: false, duplicate: false, reason: 'disabled' }
      }
      if (!sink) {
        return { ok: false, reason: 'no_sink' }
      }

      const raw =
        candidate && typeof candidate === 'object'
          ? (candidate as Record<string, unknown>)
          : null
      if (!raw) return { ok: false, reason: 'invalid_candidate' }

      const sanitized = sanitizeShadowTelemetryEvent(raw)
      if (!sanitized.ok) return { ok: false, reason: sanitized.reason }

      const key = dedupeKey(sanitized.event)
      if (preventDuplicates && seen.has(key)) {
        return { ok: true, accepted: false, duplicate: true }
      }
      if (preventDuplicates) seen.add(key)

      sink.write(sanitized.event)
      return { ok: true, accepted: true, duplicate: false }
    },
  }
}
