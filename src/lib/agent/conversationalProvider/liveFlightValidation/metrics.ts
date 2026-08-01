/**
 * Sprint 80 P2 — validation telemetry rates + latency helpers.
 */

import type { FlightPilotTelemetrySnapshot } from '../telemetry'
import type { LatencyBreakdown, ValidationTelemetryRates } from './types'

export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10000) / 10000
}

export function buildValidationTelemetryRates(
  snapshot: FlightPilotTelemetrySnapshot,
  extras?: {
    timeouts?: number
    authFailures?: number
    emptyResponses?: number
    providerErrors?: number
  },
): ValidationTelemetryRates {
  const searches = snapshot.searches
  const timeouts = extras?.timeouts
    ?? snapshot.events.filter((e) => e.errorCode === 'TIMEOUT').length
  const authFailures = extras?.authFailures
    ?? snapshot.events.filter((e) => e.errorCode === 'AUTH_FAILURE').length
  const emptyCount = extras?.emptyResponses ?? 0
  const providerErrors = extras?.providerErrors
    ?? snapshot.events.filter((e) =>
      e.errorCode != null
      && e.errorCode !== 'TIMEOUT'
      && e.errorCode !== 'AUTH_FAILURE'
      && e.errorCode !== 'INVALID_REQUEST',
    ).length

  return {
    searches,
    successes: snapshot.successes,
    failures: snapshot.failures,
    successRate: rate(snapshot.successes, searches),
    timeoutRate: rate(timeouts, searches),
    authFailureRate: rate(authFailures, searches),
    emptyResponseRate: rate(emptyCount, searches),
    providerErrorRate: rate(providerErrors, searches),
    fallbackRate: rate(snapshot.fallbacks, searches),
  }
}

export function buildLatencyBreakdown(input: {
  providerResponseMs: number
  normalizationMs: number
  totalSearchMs: number
  legacySearchMs: number
}): LatencyBreakdown {
  return {
    providerResponseMs: Math.max(0, Math.round(input.providerResponseMs)),
    normalizationMs: Math.max(0, Math.round(input.normalizationMs)),
    totalSearchMs: Math.max(0, Math.round(input.totalSearchMs)),
    legacySearchMs: Math.max(0, Math.round(input.legacySearchMs)),
  }
}
