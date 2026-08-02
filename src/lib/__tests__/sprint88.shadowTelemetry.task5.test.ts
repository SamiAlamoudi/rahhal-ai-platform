/**
 * Sprint 88 Task 5 — Shadow telemetry skeleton tests.
 * Infrastructure only — not wired into BrainRouter / planTurn.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_PREVIEW_FEATURE_ID,
  PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
  SHADOW_TELEMETRY_CONTRACT_VERSION,
  createInMemoryShadowTelemetrySink,
  createShadowTelemetryEmitter,
  isForbiddenTelemetryKey,
  redactTelemetryRecord,
  sanitizeShadowTelemetryEvent,
  toLatencyBucket,
} from '../brain/v1'
import { RECOVERY_TURN_OWNER } from '../recovery/freeze'

function baseEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    traceId: 'trace-1',
    conversationId: 'conv-1',
    timestamp: '2026-08-01T00:00:00.000Z',
    scenarioId: 'G01',
    plannerVersion: PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
    previewEnabled: true,
    fallbackTriggered: false,
    executionStage: 'preview_route',
    latencyBucket: 'lt_100ms',
    resultStatus: 'ok',
    errorCategory: null,
    ...overrides,
  }
}

describe('Sprint 88 Task 5 — Shadow telemetry', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps Brain flags OFF and recovery owner unchanged', () => {
    expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
    expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
    expect(RECOVERY_TURN_OWNER).toBe('TravelBrain.processTurn')
    expect(getFeatureRegistry().list().map((f) => f.id)).not.toContain('ai.tie.v1')
    expect(SHADOW_TELEMETRY_CONTRACT_VERSION).toMatch(/shadow-telemetry/)
  })

  describe('redaction', () => {
    it('strips forbidden keys and sensitive strings', () => {
      expect(isForbiddenTelemetryKey('userText')).toBe(true)
      expect(isForbiddenTelemetryKey('passport')).toBe(true)
      expect(isForbiddenTelemetryKey('searchQuery')).toBe(true)
      expect(isForbiddenTelemetryKey('traceId')).toBe(false)

      const redacted = redactTelemetryRecord({
        traceId: 't1',
        userText: 'I want Morocco',
        passport: 'A123',
        email: 'a@b.com',
        phone: '555-123-4567',
        payment: 'visa',
        bookingId: 'BK1',
        providerPayload: { raw: true },
        searchQuery: 'RUH-CMN',
        previewEnabled: true,
        nested: { name: 'secret', latencyBucket: 'lt_50ms' },
      })
      expect(redacted.userText).toBeUndefined()
      expect(redacted.passport).toBeUndefined()
      expect(redacted.email).toBeUndefined()
      expect(redacted.searchQuery).toBeUndefined()
      expect(redacted.previewEnabled).toBe(true)
      expect((redacted.nested as Record<string, unknown>).name).toBeUndefined()
      expect((redacted.nested as Record<string, unknown>).latencyBucket).toBe('lt_50ms')
    })

    it('sanitizeShadowTelemetryEvent builds safe contract events', () => {
      const result = sanitizeShadowTelemetryEvent(
        baseEvent({
          userMessage: 'hello',
          passport: 'X',
        }),
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.event.schemaVersion).toBe(SHADOW_TELEMETRY_CONTRACT_VERSION)
      expect(result.event.traceId).toBe('trace-1')
      expect(JSON.stringify(result.event)).not.toMatch(/userMessage|passport|I want/i)
    })
  })

  describe('emitter', () => {
    it('disabled mode drops events (default)', () => {
      const sink = createInMemoryShadowTelemetrySink()
      const emitter = createShadowTelemetryEmitter({ sink })
      expect(emitter.enabled).toBe(false)
      const result = emitter.emit(baseEvent())
      expect(result).toEqual({
        ok: true,
        accepted: false,
        duplicate: false,
        reason: 'disabled',
      })
      expect(sink.count()).toBe(0)
    })

    it('emits preview evaluation events when enabled', () => {
      const sink = createInMemoryShadowTelemetrySink()
      const emitter = createShadowTelemetryEmitter({ enabled: true, sink })
      const result = emitter.emit(baseEvent())
      expect(result).toEqual({ ok: true, accepted: true, duplicate: false })
      expect(sink.count()).toBe(1)
      expect(sink.list()[0]?.scenarioId).toBe('G01')
      expect(sink.list()[0]?.previewEnabled).toBe(true)
      expect(sink.list()[0]?.fallbackTriggered).toBe(false)
    })

    it('emits fallback events with sanitized error category', () => {
      const sink = createInMemoryShadowTelemetrySink()
      const emitter = createShadowTelemetryEmitter({ enabled: true, sink })
      const result = emitter.emit(
        baseEvent({
          traceId: 'trace-fallback',
          fallbackTriggered: true,
          executionStage: 'fallback',
          resultStatus: 'fallback',
          errorCategory: 'brain_exception',
          userText: 'must not persist',
        }),
      )
      expect(result.ok && result.accepted).toBe(true)
      const event = sink.list()[0]!
      expect(event.fallbackTriggered).toBe(true)
      expect(event.resultStatus).toBe('fallback')
      expect(event.errorCategory).toBe('brain_exception')
      expect(JSON.stringify(event)).not.toContain('must not persist')
      expect(JSON.stringify(event)).not.toContain('userText')
    })

    it('prevents duplicate emissions for the same dedupe key', () => {
      const sink = createInMemoryShadowTelemetrySink()
      const emitter = createShadowTelemetryEmitter({ enabled: true, sink })
      const first = emitter.emit(baseEvent())
      const second = emitter.emit(baseEvent())
      expect(first).toEqual({ ok: true, accepted: true, duplicate: false })
      expect(second).toEqual({ ok: true, accepted: false, duplicate: true })
      expect(sink.count()).toBe(1)
      emitter.resetDedup()
      const third = emitter.emit(baseEvent())
      expect(third).toEqual({ ok: true, accepted: true, duplicate: false })
      expect(sink.count()).toBe(2)
    })
  })

  describe('latency buckets', () => {
    it('maps durations deterministically', () => {
      expect(toLatencyBucket(10)).toBe('lt_50ms')
      expect(toLatencyBucket(75)).toBe('lt_100ms')
      expect(toLatencyBucket(200)).toBe('lt_250ms')
      expect(toLatencyBucket(400)).toBe('lt_500ms')
      expect(toLatencyBucket(800)).toBe('lt_1000ms')
      expect(toLatencyBucket(1500)).toBe('gte_1000ms')
      expect(toLatencyBucket(null)).toBe('unknown')
    })
  })
})
