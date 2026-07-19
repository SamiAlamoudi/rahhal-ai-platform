/**
 * Sprint 33 — ExecutionSummary builder.
 */

import type { BookingSessionRecord, ExecutionSummary } from './ExecutionTypes'

export function buildExecutionSummary(session: BookingSessionRecord): ExecutionSummary {
  const started = session.startedAt ? Date.parse(session.startedAt) : Date.now()
  const ended = session.completedAt ? Date.parse(session.completedAt) : Date.now()
  const providersUsed = [
    session.flightReservation?.providerId,
    session.hotelReservation?.providerId,
  ].filter((p): p is string => Boolean(p))

  const confidenceScore = clamp01(
    (session.context.selectedItinerary.confidence ?? 0.7)
    * (session.state === 'COMPLETED' ? 1 : 0.4)
    * (session.warnings.length ? 0.95 : 1),
  )

  return {
    sessionId: session.context.sessionId,
    state: session.state,
    references: { ...session.references },
    flightConfirmation: session.flightReservation,
    hotelConfirmation: session.hotelReservation,
    pricing: { ...session.context.pricing },
    currency: session.context.currency,
    warnings: [...session.warnings],
    providersUsed,
    confidenceScore,
    executionDurationMs: Math.max(0, ended - started),
    retryCount: session.retryCount,
    success: session.state === 'COMPLETED',
    error: session.error,
  }
}

export type { ExecutionSummary }

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
