/**
 * Sprint 94 — booking audit trail (no secrets).
 */

import type { BookingAuditEvent, BookingAuditEventName } from './types'

export function createBookingAudit(): {
  events: BookingAuditEvent[]
  record: (
    name: BookingAuditEventName,
    sessionId: string,
    detail?: Record<string, unknown>,
    durationMs?: number,
  ) => void
} {
  const events: BookingAuditEvent[] = []
  return {
    events,
    record(name, sessionId, detail = {}, durationMs) {
      events.push({
        name,
        at: new Date().toISOString(),
        sessionId,
        durationMs,
        detail: sanitize(detail),
      })
    },
  }
}

function sanitize(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(detail)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('secret')
      || lower.includes('password')
      || lower.includes('token')
      || lower.includes('authorization')
    ) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = value
  }
  return out
}
