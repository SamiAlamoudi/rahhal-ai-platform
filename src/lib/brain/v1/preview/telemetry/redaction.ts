/**
 * Sprint 88 Task 5 — Telemetry redaction helpers.
 * Strip / reject sensitive fields before any sink accepts an event.
 */

import type { ShadowPreviewTelemetryEvent } from './types'
import { SHADOW_TELEMETRY_CONTRACT_VERSION } from './types'

const FORBIDDEN_KEY =
  /^(user(Text|Message|Content)?|message|messages|reply|passport|name|fullName|email|phone|payment|card|bookingId|booking|pnr|providerPayload|searchQuery|query|rawProvider|password|token|secret)$/i

const FORBIDDEN_SUBSTRING =
  /passport|email|phone|payment|card.?number|booking.?id|\bpnr\b|provider.?payload|search.?query|user.?message/i

export const SHADOW_TELEMETRY_FORBIDDEN_KEYS = [
  'userText',
  'userMessage',
  'message',
  'messages',
  'reply',
  'passport',
  'name',
  'fullName',
  'email',
  'phone',
  'payment',
  'bookingId',
  'booking',
  'pnr',
  'providerPayload',
  'searchQuery',
  'query',
] as const

/** True when a key must never appear on telemetry events. */
export function isForbiddenTelemetryKey(key: string): boolean {
  return FORBIDDEN_KEY.test(key) || FORBIDDEN_SUBSTRING.test(key)
}

/**
 * Remove forbidden keys from a plain object (shallow + one nested level).
 * Does not invent values — only deletes unsafe keys.
 */
export function redactTelemetryRecord(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isForbiddenTelemetryKey(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested: Record<string, unknown> = {}
      for (const [nk, nv] of Object.entries(value as Record<string, unknown>)) {
        if (isForbiddenTelemetryKey(nk)) continue
        if (typeof nv === 'string' && looksLikeSensitiveString(nv)) continue
        nested[nk] = nv
      }
      out[key] = nested
      continue
    }
    if (typeof value === 'string' && looksLikeSensitiveString(value)) continue
    out[key] = value
  }
  return out
}

function looksLikeSensitiveString(value: string): boolean {
  if (/@/.test(value) && /\./.test(value)) return true
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(value)) return true
  if (/\b\d{13,19}\b/.test(value)) return true
  if (/passport|visa\s*number/i.test(value)) return true
  return false
}

/**
 * Validate + normalize a candidate event into the safe contract shape.
 * Drops any extra properties (including forbidden ones).
 */
export function sanitizeShadowTelemetryEvent(
  candidate: Record<string, unknown>,
): { ok: true; event: ShadowPreviewTelemetryEvent } | { ok: false; reason: string } {
  const redacted = redactTelemetryRecord(candidate)

  for (const key of Object.keys(candidate)) {
    if (isForbiddenTelemetryKey(key)) {
      // Forbidden keys are stripped; continue building from redacted.
      break
    }
  }

  const traceId = redacted.traceId
  if (typeof traceId !== 'string' || !traceId.trim()) {
    return { ok: false, reason: 'missing_traceId' }
  }

  const timestamp = redacted.timestamp
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return { ok: false, reason: 'missing_timestamp' }
  }

  const plannerVersion = redacted.plannerVersion
  if (typeof plannerVersion !== 'string' || !plannerVersion.trim()) {
    return { ok: false, reason: 'missing_plannerVersion' }
  }

  if (typeof redacted.previewEnabled !== 'boolean') {
    return { ok: false, reason: 'missing_previewEnabled' }
  }
  if (typeof redacted.fallbackTriggered !== 'boolean') {
    return { ok: false, reason: 'missing_fallbackTriggered' }
  }

  const event: ShadowPreviewTelemetryEvent = {
    schemaVersion: SHADOW_TELEMETRY_CONTRACT_VERSION,
    traceId: traceId.trim(),
    conversationId:
      typeof redacted.conversationId === 'string' || redacted.conversationId === null
        ? (redacted.conversationId as string | null)
        : null,
    timestamp,
    scenarioId: typeof redacted.scenarioId === 'string' ? redacted.scenarioId : null,
    plannerVersion: plannerVersion.trim(),
    previewEnabled: redacted.previewEnabled,
    fallbackTriggered: redacted.fallbackTriggered,
    executionStage: (redacted.executionStage as ShadowPreviewTelemetryEvent['executionStage'])
      ?? 'evaluate',
    latencyBucket: (redacted.latencyBucket as ShadowPreviewTelemetryEvent['latencyBucket'])
      ?? 'unknown',
    resultStatus: (redacted.resultStatus as ShadowPreviewTelemetryEvent['resultStatus'])
      ?? 'skipped_disabled',
    errorCategory:
      redacted.errorCategory === undefined
        ? null
        : (redacted.errorCategory as ShadowPreviewTelemetryEvent['errorCategory']),
  }

  // Final guard: serialized event must not contain forbidden key names.
  const serialized = JSON.stringify(event)
  for (const bad of SHADOW_TELEMETRY_FORBIDDEN_KEYS) {
    if (new RegExp(`"${bad}"`, 'i').test(serialized)) {
      return { ok: false, reason: `forbidden_key_present:${bad}` }
    }
  }

  return { ok: true, event }
}

/** Map milliseconds into a coarse bucket (no raw latency stored by default helpers). */
export function toLatencyBucket(durationMs: number | null | undefined): ShadowPreviewTelemetryEvent['latencyBucket'] {
  if (durationMs == null || Number.isNaN(durationMs) || durationMs < 0) return 'unknown'
  if (durationMs < 50) return 'lt_50ms'
  if (durationMs < 100) return 'lt_100ms'
  if (durationMs < 250) return 'lt_250ms'
  if (durationMs < 500) return 'lt_500ms'
  if (durationMs < 1000) return 'lt_1000ms'
  return 'gte_1000ms'
}
