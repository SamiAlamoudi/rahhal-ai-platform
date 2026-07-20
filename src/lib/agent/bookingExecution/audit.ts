/**
 * Booking audit trail — Sprint 57.
 */

import type { BookingAuditEntry, BookingLifecycleStatus } from './types'

export class BookingAuditTrail {
  private readonly entries: BookingAuditEntry[] = []

  record(input: {
    sessionId: string
    bookingId?: string | null
    provider?: string | null
    latencyMs?: number | null
    error?: string | null
    action: string
    fromStatus?: BookingLifecycleStatus | null
    toStatus?: BookingLifecycleStatus | null
    detail?: Record<string, unknown>
    now?: () => number
  }): BookingAuditEntry {
    const now = input.now ?? (() => Date.now())
    const entry: BookingAuditEntry = {
      id: `aud_${Math.random().toString(36).slice(2, 10)}`,
      sessionId: input.sessionId,
      bookingId: input.bookingId ?? null,
      at: new Date(now()).toISOString(),
      provider: input.provider ?? null,
      latencyMs: input.latencyMs ?? null,
      error: input.error ?? null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      detail: input.detail,
    }
    this.entries.push(entry)
    return entry
  }

  list(sessionId?: string): BookingAuditEntry[] {
    if (!sessionId) return [...this.entries]
    return this.entries.filter((e) => e.sessionId === sessionId)
  }

  hydrate(entries: BookingAuditEntry[]): void {
    this.entries.length = 0
    this.entries.push(...entries)
  }

  clear(): void {
    this.entries.length = 0
  }
}
